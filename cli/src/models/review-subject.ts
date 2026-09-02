import type { AssistFileRecord, AssistInputs, AssistFile } from "@/types.js";

import fg from "fast-glob";
import { createHash } from "node:crypto";

import { errors } from "@/helpers/errors-helper.js";
import { exists, hasGlobChars, readText } from "@/helpers/files-helper.js";
import { joinPath, parentDir, relativePath } from "@/helpers/paths-helper.js";
import { DEFAULT_SPEC_FILE_PATTERN } from "@/models/praxis-config.js";
import { SpecFile } from "@/models/spec-file.js";

/**
 * Everything a reviewer is shown about one target: the target itself, the
 * spec it is reviewed against, and the spec's assist inputs.
 *
 * Assembled once and read many times — the content hash, the prompt,
 * and the cache provenance all derive from the same resolved state, so
 * a verdict can never be keyed on inputs the reviewer did not see.
 *
 * A cohort arrives here already assembled (`targetContent` supplied);
 * a plain file is read from disk. `kind` distinguishes them for the
 * prompt, which frames a set differently from a single file.
 */
export class ReviewSubject {
  /** Path of the target under review. */
  readonly targetPath: string;
  /** Path of the spec the target is reviewed against. */
  readonly specPath: string;
  /** Target content as read (or assembled) at construction time. */
  readonly targetContent: string;
  /** Spec content as read at construction time. */
  readonly specContent: string;
  /** Whether the target is one file or a pre-assembled cohort. */
  readonly kind: "file" | "cohort";
  /** The spec's resolved assist inputs: exemplars and context files. */
  readonly assist: AssistInputs;

  private constructor(fields: {
    targetPath: string;
    specPath: string;
    targetContent: string;
    specContent: string;
    kind: "file" | "cohort";
    assist: AssistInputs;
  }) {
    this.targetPath = fields.targetPath;
    this.specPath = fields.specPath;
    this.targetContent = fields.targetContent;
    this.specContent = fields.specContent;
    this.kind = fields.kind;
    this.assist = fields.assist;
  }

  /**
   * Resolves a target and its spec into a review input.
   *
   * @throws PraxisError when no spec can be found for the target, or
   *   the spec declares assist globs and no root resolves them
   */
  static resolve({
    targetPath,
    targetContent,
    kind = "file",
    specPath,
    specFilePattern = DEFAULT_SPEC_FILE_PATTERN,
    root,
  }: {
    targetPath: string;
    /** Pre-assembled input (cohorts); read from targetPath when omitted. */
    targetContent?: string;
    kind?: "file" | "cohort";
    specPath?: string;
    specFilePattern?: string;
    /** Project root; required when the spec declares scoping globs. */
    root?: string;
  }): ReviewSubject {
    const resolvedSpec = specPath ?? findSpec(targetPath, specFilePattern);
    const specContent = readText(resolvedSpec);

    return new ReviewSubject({
      targetPath,
      specPath: resolvedSpec,
      targetContent: targetContent ?? readText(targetPath),
      specContent,
      kind,
      assist: resolveAssist(specContent, resolvedSpec, root),
    });
  }

  /**
   * The cache-invalidation hash over the full review input.
   *
   * Target, spec and assist all participate, so editing any input the
   * reviewer saw invalidates the verdict keyed on it.
   */
  contentHash(): string {
    return hash8(this.targetContent + this.specContent + this.assistInput());
  }

  /** Provenance hash of the target alone, for the ledger (05). */
  targetContentHash(): string {
    return hash8(this.targetContent);
  }

  /** Provenance hash of the spec alone, for the ledger (05). */
  specContentHash(): string {
    return hash8(this.specContent);
  }

  /**
   * The assist component of the content hash.
   *
   * Kind and path label each block so distinct assist states can never
   * serialize identically. Empty when the spec declares no assist inputs,
   * which keeps plain specs' hashes unchanged.
   */
  private assistInput(): string {
    return [
      ...this.assist.exemplars.map((file) => `EXEMPLAR ${file.path}\n${file.content}`),
      ...this.assist.context.map((file) => `CONTEXT ${file.path}\n${file.content}`),
    ].join("\n");
  }

  /** Per-file provenance for the cache entry: what was inlined, and its hash. */
  assistProvenance(): { exemplarFiles: AssistFileRecord[]; contextFiles: AssistFileRecord[] } {
    return {
      exemplarFiles: records(this.assist.exemplars),
      contextFiles: records(this.assist.context),
    };
  }
}

/**
 * Resolves the spec's `exemplars:` and `context:` globs into file contents.
 *
 * The assist inputs a reviewer sees beyond the target itself (03): exemplars
 * are spec-blessed positives, context is what the standard is about. Both
 * reach the prompt, so both join the content hash — a verdict keyed only on
 * target + spec would survive edits to inputs the reviewer actually saw.
 *
 * @throws PraxisError when the spec declares either key and no project root
 *   is available to resolve the root-relative globs against
 */
function resolveAssist(specContent: string, specPath: string, root?: string): AssistInputs {
  const spec = SpecFile.fromContent(specContent, specPath);

  return {
    exemplars: resolveAssistKey(spec, "exemplars", root),
    context: resolveAssistKey(spec, "context", root),
  };
}

/**
 * Resolves one assist key's globs into labeled file contents, sorted so
 * the content hash is stable across machines.
 */
function resolveAssistKey(
  spec: SpecFile,
  key: "exemplars" | "context",
  root?: string,
): AssistFile[] {
  const patterns = spec.assistPatterns(key);

  if (patterns.length === 0) return [];

  if (!root) throw errors.missingProjectRoot(key, spec.path);

  return fg
    .sync(patterns, { cwd: root, onlyFiles: true, absolute: true, dot: true })
    .sort()
    .map((file) => ({ path: relativePath(root, file), content: readText(file) }));
}

/**
 * Finds the spec file governing a target, by the configured pattern.
 *
 * @throws PraxisError when the directory holds no matching spec
 */
function findSpec(targetPath: string, specFilePattern: string): string {
  const baseDir = parentDir(targetPath);

  if (!hasGlobChars(specFilePattern)) {
    const specPath = joinPath(baseDir, specFilePattern);

    if (exists(specPath)) return specPath;

    throw errors.specNotFound(specFilePattern, baseDir, targetPath);
  }

  const matches = fg.sync(specFilePattern, { cwd: baseDir, onlyFiles: true, absolute: true });

  if (matches.length > 0) return matches[0];

  throw errors.specPatternNotFound(specFilePattern, baseDir, targetPath);
}

/**
 * The provenance records for one assist key (05): each file's path with
 * an 8-char hash of its content, so a later run can tell whether what the
 * reviewer was shown has changed.
 */
function records(files: AssistFile[]): AssistFileRecord[] {
  return files.map((file) => ({
    path: file.path,
    hash: hash8(file.content),
  }));
}

/** The codebase's standard 8-char sha256 prefix. */
function hash8(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 8);
}
