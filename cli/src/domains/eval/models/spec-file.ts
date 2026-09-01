import type { CohortMode } from "@/domains/eval/types.js";

import { relativePath } from "@/core/paths.js";
import { Fields } from "@/models/fields.js";

/** The accepted `cohort:` frontmatter values. */
const COHORT_MODES: readonly CohortMode[] = ["by_file", "by_directory"];

/**
 * A spec document — the README the eval layer judges targets against.
 *
 * Names the frontmatter keys the eval layer honors, in one place,
 * instead of leaving them as string literals scattered across
 * discovery and assist resolution. Its `paths:` is the spec layer's
 * `validates:` after compilation (see `evalTargetingLines`); this model
 * and `ExpertFile` are the read and write ends of that one contract.
 *
 * Every field is read and validated in the constructor, so a SpecFile
 * that exists is a valid spec. Patterns come back as written, for the
 * caller to resolve against a root: resolving paths is not a document's
 * job.
 *
 * @throws PraxisError when any declared field is malformed
 */
export class SpecFile {
  /** Absolute path to the spec file. */
  readonly path: string;
  /** Glob patterns naming the targets this spec judges (`paths:`). */
  readonly paths: string[];
  /** How this spec's targets group into units; `by_file` when undeclared. */
  readonly cohort: CohortMode;
  /** Patterns structurally excluded from judgment, as written. */
  readonly excludes: string[];
  /** Spec-blessed positive examples, as written. */
  readonly exemplars: string[];
  /** Assist-only material inlined into the judgment, as written. */
  readonly context: string[];

  private constructor(fields: Fields, path: string) {
    this.path = path;
    this.paths = fields.stringList("paths");
    this.cohort = fields.enumValue("cohort", COHORT_MODES) ?? "by_file";
    this.excludes = fields.stringList("excludes");
    this.exemplars = fields.stringList("exemplars");
    this.context = fields.stringList("context");
  }

  /** Reads and validates a spec from disk. */
  static at(path: string, root?: string): SpecFile {
    return new SpecFile(Fields.fromFile(path, display(path, root)), path);
  }

  /**
   * Reads and validates a spec from already-loaded content.
   *
   * For callers that read the file for other purposes and should not
   * pay for a second filesystem read.
   */
  static fromContent(content: string, path: string, root?: string): SpecFile {
    return new SpecFile(Fields.fromContent(content, display(path, root)), path);
  }

  /**
   * Patterns for one assist key — inputs that reach the judge as
   * inlined material rather than as targets.
   *
   * @param key - `exemplars` (shielded positives) or `context`
   */
  assistPatterns(key: "exemplars" | "context"): string[] {
    return key === "exemplars" ? this.exemplars : this.context;
  }
}

/** A spec's path as it should appear in a message to its author. */
function display(path: string, root?: string): string {
  return root ? relativePath(root, path) : path;
}
