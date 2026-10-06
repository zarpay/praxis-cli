import type { AssistFileRecord, AssistFile } from "@/types.js";

import fg from "fast-glob";

import { errors } from "@/helpers/errors-helper.js";
import { readText } from "@/helpers/files-helper.js";
import { hash8 } from "@/helpers/hash-helper.js";
import { relativePath } from "@/helpers/paths-helper.js";
import { SpecFile } from "@/models/spec-file.js";

/** A spec's resolved assist inputs, one list per frontmatter key. */
interface AssistInputs {
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
 * The hash covers exactly the materials interpolated into the prompt:
 * no more, so routing metadata cannot force a re-review; no less, so a
 * changed prompt can never hit a cached verdict. That invariant is
 * what makes a spec's frontmatter absent from both — it declares where
 * the spec applies, never how a target is judged. A future frontmatter
 * key that genuinely changed a review would change the prompt, and the
 * hash would follow it for free; one that changes a reviewer's
 * behavior without changing the prompt belongs in the reviewer's
 * behavioral hash (`Reviewer.hash`), which stays exclusion-based.
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
  /** The spec's prose, frontmatter stripped: the standard being applied. */
  readonly specBody: string;
  /** Whether the target is one file or a pre-assembled cohort. */
  readonly kind: "file" | "cohort";
  /** The spec's resolved assist inputs: context files. */
  readonly assist: AssistInputs;

  private constructor(fields: {
    targetPath: string;
    specPath: string;
    targetContent: string;
    specBody: string;
    kind: "file" | "cohort";
    assist: AssistInputs;
  }) {
    this.targetPath = fields.targetPath;
    this.specPath = fields.specPath;
    this.targetContent = fields.targetContent;
    this.specBody = fields.specBody;
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
    root,
  }: {
    targetPath: string;
    /** Pre-assembled input (cohorts); read from targetPath when omitted. */
    targetContent?: string;
    kind?: "file" | "cohort";
    /** The governing spec, located by the caller (SpecStore.governingPath). */
    specPath: string;
    /** Project root; required when the spec declares scoping globs. */
    root?: string;
  }): ReviewSubject {
    const spec = SpecFile.fromContent(readText(specPath), specPath);

    return new ReviewSubject({
      targetPath,
      specPath,
      targetContent: targetContent ?? readText(targetPath),
      specBody: spec.body(),
      kind,
      assist: resolveAssist(spec, root),
    });
  }

  /**
   * The cache-invalidation hash over the full review input.
   *
   * Target, spec body, and assist all participate — everything the
   * reviewer saw and nothing else. The spec's frontmatter is out:
   * retargeting a spec with `paths:` changes which files are reviewed,
   * never the verdict on any one of them, and a `context:` glob
   * rewritten to resolve to the same files leaves the prompt identical.
   * Both used to cost a full re-review for no change in question.
   */
  contentHash(): string {
    return hash8(this.targetContent + this.specBody + this.assistInput());
  }

  /** Provenance hash of the target alone, for the ledger. */
  targetContentHash(): string {
    return hash8(this.targetContent);
  }

  /**
   * Provenance hash of the spec alone, for the ledger.
   *
   * Over the body, like the cache hash: "the spec changed" in the
   * ledger must mean the standard changed, not that someone added a
   * glob no verdict could reflect.
   */
  specContentHash(): string {
    return hash8(this.specBody);
  }

  /**
   * The assist component of the content hash.
   *
   * Kind and path label each block so distinct assist states can never
   * serialize identically. Empty when the spec declares no assist inputs,
   * which keeps plain specs' hashes unchanged.
   */
  private assistInput(): string {
    return this.assist.context.map((file) => `CONTEXT ${file.path}\n${file.content}`).join("\n");
  }

  /** Per-file provenance for the cache entry: what was inlined, and its hash. */
  assistProvenance(): { contextFiles: AssistFileRecord[] } {
    return {
      contextFiles: records(this.assist.context),
    };
  }
}

/**
 * Resolves the spec's `context:` globs into file contents.
 *
 * The assist input a reviewer sees beyond the target itself: context is
 * what the standard is about. It reaches the prompt, so it joins the
 * content hash — a verdict keyed only on target + spec would survive
 * edits to inputs the reviewer actually saw. (The former `exemplars:`
 * key is retired: live code held up as a blessed example drifts —
 * nothing stops an edit to the exemplar from turning a bad example
 * exemplary. Positive examples belong in the spec's own prose.)
 *
 * Resolved files are sorted, so the content hash is stable across
 * machines.
 *
 * @throws PraxisError when the spec declares the key and no project root
 *   is available to resolve the root-relative globs against
 */
function resolveAssist(spec: SpecFile, root?: string): AssistInputs {
  const patterns = spec.contextPatterns();

  if (patterns.length === 0) return { context: [] };

  if (!root) throw errors.missingProjectRoot("context", spec.path);

  const context = fg
    .sync(patterns, { cwd: root, onlyFiles: true, absolute: true, dot: true })
    .sort()
    .map((file) => ({ path: relativePath(root, file), content: readText(file) }));

  return { context };
}

/**
 * The provenance records for one assist key: each file's path with
 * an 8-char hash of its content, so a later run can tell whether what the
 * reviewer was shown has changed.
 */
function records(files: AssistFile[]): AssistFileRecord[] {
  return files.map((file) => ({
    path: file.path,
    hash: hash8(file.content),
  }));
}
