import type { CohortMode, RefKey } from "@/types.js";

import { Fields } from "@/models/fields.js";

/** The accepted `cohort:` frontmatter values. */
const COHORT_MODES: readonly CohortMode[] = ["by_file", "by_directory"];

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
 * Every field is read and validated in the constructor, so an
 * ExpertFile that exists is a valid expert. `alias` is required — it is
 * the document's identity, and a file without one is not an expert.
 * Callers that scan a directory (`compileAll`, `praxis status`) catch
 * the failure per file and report it, so one malformed document never
 * takes down a batch.
 *
 * Note `cohort` is validated here against the same enum `SpecFile`
 * uses. It is written into the compiled spec, so an invalid value
 * caught at compile time is one the eval layer never has to raise on.
 *
 * @throws PraxisError when `alias` is absent, or any field is malformed
 */
export class ExpertFile {
  /** Absolute path to the expert file. */
  readonly path: string;
  /** The expert's short name, and the compiled agent's filename. */
  readonly alias: string;
  /** What the agent is for; absent means no agent metadata is emitted. */
  readonly description: string | undefined;
  /** Constitution glob patterns, as written. */
  readonly constitution: string[];
  /** Tools the compiled agent may use (`agent_tools:`). */
  readonly agentTools: string | undefined;
  /** Model the compiled agent runs on (`agent_model:`). */
  readonly agentModel: string | undefined;
  /** Permission mode the compiled agent runs under (`agent_permission_mode:`). */
  readonly agentPermissionMode: string | undefined;
  /** Targets this expert judges; compiled out as the spec's `paths:`. */
  readonly validates: string[];
  /** How compiled targets group into units; undeclared stays unwritten. */
  readonly cohort: CohortMode | undefined;
  /** Patterns compiled out as the spec's `excludes:`. */
  readonly excludes: string[];
  /** Patterns compiled out as the spec's `exemplars:`. */
  readonly exemplars: string[];

  private readonly references: Record<RefKey, string[]>;

  private constructor(fields: Fields, path: string) {
    this.path = path;
    this.alias = fields.requiredString("alias");
    this.description = fields.optionalString("description");
    this.constitution = fields.stringList("constitution");
    this.agentTools = fields.optionalString("agent_tools");
    this.agentModel = fields.optionalString("agent_model");
    this.agentPermissionMode = fields.optionalString("agent_permission_mode");
    this.validates = fields.stringList("validates");
    this.cohort = fields.enumValue("cohort", COHORT_MODES);
    this.excludes = fields.stringList("excludes");
    this.exemplars = fields.stringList("exemplars");
    this.references = {
      practices: fields.stringList("practices"),
      context: fields.stringList("context"),
      refs: fields.stringList("refs"),
    };
  }

  /** Reads and validates an expert from disk. */
  static at(path: string): ExpertFile {
    return new ExpertFile(Fields.fromFile(path, path), path);
  }

  /** Reads and validates an expert from already-loaded content. */
  static fromContent(content: string, path: string): ExpertFile {
    return new ExpertFile(Fields.fromContent(content, path), path);
  }

  /**
   * Patterns for one reference key, as written.
   *
   * @param key - the section this feeds: responsibilities, context, or reference
   */
  refs(key: RefKey): string[] {
    return this.references[key];
  }
}
