import type { AssistFileRecord, AssistFile, ChecklistAxiom } from "@/types.js";

import fg from "fast-glob";
import { createHash } from "node:crypto";

import { errors } from "@/helpers/errors-helper.js";
import { readText } from "@/helpers/files-helper.js";
import { relativePath } from "@/helpers/paths-helper.js";
import { SpecFile } from "@/models/spec-file.js";

/** A spec's resolved assist inputs, one list per frontmatter key. */
interface AssistInputs {
  /** Spec-blessed positive examples — shielded from adverse review. */
  exemplars: AssistFile[];
  /** Assist-only context — informs the review, never receives a verdict. */
  context: AssistFile[];
}

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
  /** The active axioms grounded in the spec — the checklist channel (04). */
  readonly checklist: ChecklistAxiom[];

  private constructor(fields: {
    targetPath: string;
    specPath: string;
    targetContent: string;
    specContent: string;
    kind: "file" | "cohort";
    assist: AssistInputs;
    checklist: ChecklistAxiom[];
  }) {
    this.targetPath = fields.targetPath;
    this.specPath = fields.specPath;
    this.targetContent = fields.targetContent;
    this.specContent = fields.specContent;
    this.kind = fields.kind;
    this.assist = fields.assist;
    this.checklist = fields.checklist;
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
    root,
    checklistFor,
  }: {
    targetPath: string;
    /** Pre-assembled input (cohorts); read from targetPath when omitted. */
    targetContent?: string;
    kind?: "file" | "cohort";
    /** The governing spec, located by the caller (SpecStore.governingPath). */
    specPath: string;
    /** Project root; required when the spec declares scoping globs. */
    root?: string;
    /**
     * Supplies the resolved spec's checklist axioms (04). Injected by
     * the caller because the spec is discovered here but the axiom
     * store is a service's business, and models never import services.
     */
    checklistFor?: (specPath: string) => ChecklistAxiom[];
  }): ReviewSubject {
    const specContent = readText(specPath);

    return new ReviewSubject({
      targetPath,
      specPath,
      targetContent: targetContent ?? readText(targetPath),
      specContent,
      kind,
      assist: resolveAssist(specContent, specPath, root),
      checklist: checklistFor?.(specPath) ?? [],
    });
  }

  /**
   * The cache-invalidation hash over the full review input.
   *
   * Target, spec and assist all participate, so editing any input the
   * reviewer saw invalidates the verdict keyed on it.
   */
  contentHash(): string {
    return hash8(
      this.targetContent + this.specContent + this.assistInput() + this.checklistInput(),
    );
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

  /**
   * The checklist component of the content hash.
   *
   * Ratifying, versioning, or deprecating an axiom changes what the
   * reviewer is asked, so it must invalidate the verdicts of every
   * target its spec governs. Empty when no axioms govern the spec,
   * which keeps bootstrap projects' hashes — and their caches — intact.
   */
  private checklistInput(): string {
    return this.checklist
      .map((axiom) => `AXIOM ${axiom.id} v${axiom.version}\n${axiom.body}`)
      .join("\n");
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
