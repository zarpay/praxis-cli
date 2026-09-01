import type { AssistFileRecord, AssistInputs } from "@/domains/eval/types.js";

import fg from "fast-glob";

import { DEFAULT_SPEC_FILE_PATTERN } from "@/core/config.js";
import { errors } from "@/core/errors.js";
import { exists, readText } from "@/core/files.js";
import { joinPath, parentDir } from "@/core/paths.js";
import { hasGlobChars } from "@/core/spec-pattern.js";
import contentHash from "@/domains/eval/services/content-hash.js";
import {
  assistFileRecords,
  assistHashInput,
  resolveAssistInputs,
} from "@/domains/eval/services/judgment-input.js";

/**
 * Everything a judge is shown about one target: the target itself, the
 * spec it is judged against, and the spec's assist inputs.
 *
 * Assembled once and read many times — the content hash, the prompt,
 * and the cache provenance all derive from the same resolved state, so
 * a verdict can never be keyed on inputs the judge did not see.
 *
 * A cohort arrives here already assembled (`targetContent` supplied);
 * a plain file is read from disk. `kind` distinguishes them for the
 * prompt, which frames a set differently from a single file.
 */
export class JudgmentTarget {
  /** Path of the target under judgment. */
  readonly targetPath: string;
  /** Path of the spec the target is judged against. */
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
   * Resolves a target and its spec into a judgment input.
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
  }): JudgmentTarget {
    const resolvedSpec = specPath ?? findSpec(targetPath, specFilePattern);
    const specContent = readText(resolvedSpec);

    return new JudgmentTarget({
      targetPath,
      specPath: resolvedSpec,
      targetContent: targetContent ?? readText(targetPath),
      specContent,
      kind,
      assist: resolveAssistInputs({ specContent, specPath: resolvedSpec, root }),
    });
  }

  /**
   * The cache-invalidation hash over the full judgment input.
   *
   * Target, spec and assist all participate, so editing any input the
   * judge saw invalidates the verdict keyed on it.
   */
  contentHash(): string {
    return contentHash(this.targetContent, this.specContent, assistHashInput(this.assist));
  }

  /** Per-file provenance for the cache entry: what was inlined, and its hash. */
  assistProvenance(): { exemplarFiles: AssistFileRecord[]; contextFiles: AssistFileRecord[] } {
    return {
      exemplarFiles: assistFileRecords(this.assist.exemplars),
      contextFiles: assistFileRecords(this.assist.context),
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
