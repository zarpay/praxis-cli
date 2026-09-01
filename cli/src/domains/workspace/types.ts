/**
 * The workspace domain's vocabulary: the project's own health and the
 * shapes its commands take.
 *
 * Shapes more than one domain needs live in src/types.ts instead.
 */

// ---------------------------------------------------------------------------
// Workspace (domains/workspace/)
// ---------------------------------------------------------------------------

/** Content types `praxis add` can scaffold. */
export type AddableType = "expert" | "practice";

/** Options every eval invocation shares. */
export interface EvalInvocationOptions {
  /** Run only this judge (default: all configured judges). */
  judge?: string;
  verbose: boolean;
  cache: boolean;
}

/** Options for a single-target `eval run`. */
export interface DocumentOptions extends EvalInvocationOptions {
  spec?: string;
}

/** Options for a full `eval run`. */
export interface AllOptions extends EvalInvocationOptions {
  type?: string;
  failFast: boolean;
}

/** Structured report of project health. */
export interface StatusReport {
  /**
   * Whether the spec-layer compiler is in use (the experts directory
   * exists). Framework health only surfaces when it is (11): eval-only
   * projects are never asked about a taxonomy they don't have.
   */
  compilerInUse: boolean;
  /** Document counts by content type. */
  counts: {
    experts: number;
    practices: number;
    references: number;
    context: number;
  };
  /**
   * Cached verdict counts across all spec targets, one row per judge —
   * judges are separate instruments and are never silently pooled.
   * Empty when no judges are configured.
   */
  validation: {
    judge: string;
    pass: number;
    warn: number;
    fail: number;
    notValidated: number;
  }[];
  /** Expert files that failed validation, with the reason. */
  invalidExperts: { expert: string; reason: string }[];
  /** Practice files no expert references. */
  orphanedPractices: string[];
  /** Expert references pointing at files that do not exist. */
  danglingRefs: { expert: string; ref: string }[];
  /** Expert files missing the `description` frontmatter field. */
  expertsMissingDescription: string[];
  /** Expert glob references that match no files. */
  zeroMatchGlobs: { expert: string; pattern: string }[];
  /** Practices whose `owner` matches no expert alias. */
  unmatchedOwners: { practice: string; owner: string }[];
}

/**
 * What one pass over the expert files found.
 *
 * Every field answers a different structural question, but they share
 * a parse, which is why the audit produces them together.
 */
export interface ExpertAudit {
  /** Lowercased alias to the expert file that declares it. */
  aliases: Map<string, string>;
  /** Project-relative practice paths some expert points at. */
  referencedPractices: Set<string>;
  /** Experts that could not be read, with the reason. */
  invalidExperts: StatusReport["invalidExperts"];
  /** References to files that do not exist. */
  danglingRefs: StatusReport["danglingRefs"];
  /** Glob patterns matching nothing. */
  zeroMatchGlobs: StatusReport["zeroMatchGlobs"];
  /** Experts with no description, by filename. */
  missingDescriptions: string[];
}
