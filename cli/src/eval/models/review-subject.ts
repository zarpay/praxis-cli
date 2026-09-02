import type { AssistFileRecord, AssistInputs, AssistFile } from "@/eval/types.js";

import fg from "fast-glob";
import { createHash } from "node:crypto";

import resolveAssistInputs from "@/eval/services/resolve-assist-inputs-service.js";
import { errors } from "@/framework/errors.js";
import { exists, hasGlobChars, readText } from "@/framework/files.js";
import { joinPath, parentDir } from "@/framework/paths.js";
import { DEFAULT_SPEC_FILE_PATTERN } from "@/workspace/models/praxis-config.js";

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
      assist: resolveAssistInputs({ specContent, specPath: resolvedSpec, root }),
    });
  }

  /**
   * The cache-invalidation hash over the full review input.
   *
   * Target, spec and assist all participate, so editing any input the
   * reviewer saw invalidates the verdict keyed on it.
   */
  contentHash(): string {
    return createHash("sha256")
      .update(this.targetContent + this.specContent + this.assistInput())
      .digest("hex")
      .slice(0, 8);
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
    hash: createHash("sha256").update(file.content).digest("hex").slice(0, 8),
  }));
}
