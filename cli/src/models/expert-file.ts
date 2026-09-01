import { Frontmatter } from "@/core/frontmatter.js";

/**
 * An expert document — the authored source the spec layer compiles
 * into an SME agent profile.
 *
 * Names every frontmatter key the compiler honors, so `alias`,
 * `agent_tools` and the rest are spelled once here rather than at each
 * reader. Its `validates:` becomes the compiled spec's `paths:` (see
 * `evalTargetingLines`), which is why this model and `SpecFile` carry
 * overlapping targeting fields: they are the two ends of that contract.
 *
 * Every field is optional, and reading an absent one is normal — an
 * expert with no `alias` is skipped by the compiler and reported by
 * `praxis status`, so this model reports absence rather than throwing.
 */
export class ExpertFile {
  /** Absolute path to the expert file. */
  readonly path: string;

  private readonly fm: Frontmatter;

  private constructor(fm: Frontmatter, path: string) {
    this.fm = fm;
    this.path = path;
  }

  /** Reads an expert from disk. */
  static at(path: string): ExpertFile {
    return new ExpertFile(Frontmatter.fromFile(path), path);
  }

  /** Builds an expert from already-loaded content. */
  static fromContent(content: string, path: string): ExpertFile {
    return new ExpertFile(Frontmatter.fromContent(content), path);
  }

  /** The expert's short name; absent means "skip this file". */
  get alias(): string | undefined {
    return this.fm.optionalValue("alias");
  }

  /** What the agent is for; absent means no agent metadata is emitted. */
  get description(): string | undefined {
    return this.fm.optionalValue("description");
  }

  /**
   * Whether the expert declares a constitution at all.
   *
   * Read from the raw value, not the array: `constitution: false`
   * means "no constitution", which the array form would wrap as
   * `[false]` and send looking for a file named `false`.
   */
  get declaresConstitution(): boolean {
    return Boolean(this.fm.value("constitution"));
  }

  /** Constitution glob patterns, as written. */
  get constitution(): string[] {
    return this.fm.array("constitution");
  }

  /**
   * Patterns for one reference key, as written.
   *
   * @param key - the section this feeds: responsibilities, context, or reference
   */
  refs(key: "practices" | "context" | "refs"): string[] {
    return this.fm.array(key);
  }

  /** Tools the compiled agent may use (`agent_tools:`). */
  get agentTools(): string | undefined {
    return this.fm.optionalValue("agent_tools");
  }

  /** Model the compiled agent runs on (`agent_model:`). */
  get agentModel(): string | undefined {
    return this.fm.optionalValue("agent_model");
  }

  /** Permission mode the compiled agent runs under (`agent_permission_mode:`). */
  get agentPermissionMode(): string | undefined {
    return this.fm.optionalValue("agent_permission_mode");
  }

  /** Targets this expert judges; compiled out as the spec's `paths:`. */
  get validates(): string[] | undefined {
    return this.fm.optionalArray("validates");
  }

  /** How compiled targets group into evaluation units. */
  get cohort(): string | undefined {
    return this.fm.optionalValue("cohort");
  }

  /** Patterns compiled out as the spec's `excludes:`. */
  get excludes(): string[] | undefined {
    return this.fm.optionalArray("excludes");
  }

  /** Patterns compiled out as the spec's `exemplars:`. */
  get exemplars(): string[] | undefined {
    return this.fm.optionalArray("exemplars");
  }
}
