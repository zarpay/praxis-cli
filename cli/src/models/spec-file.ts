import type { CohortMode } from "@/types.js";

import { errors } from "@/core/errors.js";
import { Frontmatter } from "@/core/frontmatter.js";
import { relativePath } from "@/core/paths.js";

/** The accepted `cohort:` frontmatter values. */
const COHORT_MODES: readonly CohortMode[] = ["by_file", "by_directory"];

/**
 * A spec document — the README the eval layer judges targets against.
 *
 * Names the frontmatter keys the eval layer honors, in one place,
 * instead of leaving them as string literals scattered across
 * discovery and assist resolution. Its `paths:` is the spec layer's
 * `validates:` after compilation (see `evalTargetingLines`); the two
 * models are the write and read ends of that one contract.
 *
 * Reads what the file declares and nothing more: patterns come back as
 * written, for the caller to resolve against a root. An absent key is
 * normal, not an error — `cohort:` is the sole exception, because a
 * value outside the enum can only be a typo.
 */
export class SpecFile {
  /** Absolute path to the spec file. */
  readonly path: string;

  private readonly fm: Frontmatter;
  /** Project root, used only to render paths in error messages. */
  private readonly root: string | undefined;

  private constructor(fm: Frontmatter, path: string, root?: string) {
    this.fm = fm;
    this.path = path;
    this.root = root;
  }

  /** Reads a spec from disk. */
  static at(path: string, root?: string): SpecFile {
    return new SpecFile(Frontmatter.fromFile(path), path, root);
  }

  /**
   * Builds a spec from already-loaded content.
   *
   * For callers that read the file for other purposes and should not
   * pay for a second filesystem read.
   */
  static fromContent(content: string, path: string, root?: string): SpecFile {
    return new SpecFile(Frontmatter.fromContent(content), path, root);
  }

  /** Glob patterns naming the targets this spec judges (`paths:`). */
  get paths(): string[] {
    return this.fm.array("paths");
  }

  /** Patterns structurally excluded from judgment, as written. */
  get excludes(): string[] {
    return this.fm.array("excludes");
  }

  /** Spec-blessed positive examples, as written. */
  get exemplars(): string[] {
    return this.fm.array("exemplars");
  }

  /**
   * How this spec's targets group into evaluation units.
   *
   * Defaults to `by_file` when undeclared.
   *
   * @throws PraxisError when the value is outside the two-member enum
   */
  get cohort(): CohortMode {
    const raw = this.fm.value("cohort");

    if (raw === undefined || raw === null) {
      return "by_file";
    }

    if (typeof raw === "string" && (COHORT_MODES as string[]).includes(raw)) {
      return raw as CohortMode;
    }

    const shown = typeof raw === "string" ? raw : JSON.stringify(raw);
    throw errors.invalidCohortValue(shown, this.displayPath);
  }

  /**
   * Patterns for one assist key — inputs that reach the judge as
   * inlined material rather than as targets.
   *
   * @param key - `exemplars` (shielded positives) or `context`
   */
  assistPatterns(key: "exemplars" | "context"): string[] {
    return this.fm.array(key);
  }

  /** The spec's path as it should appear in a message to the author. */
  private get displayPath(): string {
    return this.root ? relativePath(this.root, this.path) : this.path;
  }
}
