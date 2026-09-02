/**
 * The workspace domain's vocabulary: the project's own health and the
 * shapes its commands take.
 *
 * Shapes more than one domain needs live in src/types.ts instead.
 */

import type { CommandContext } from "@/domains/workspace/models/command-context.js";
import type { PraxisConfig } from "@/domains/workspace/models/praxis-config.js";
import type { Paths } from "@/domains/workspace/models/project-paths.js";
import type { NoOptions, Orchestrator as BaseOrchestrator } from "@/framework/types.js";
import type { Display } from "@/framework/views/display.js";
import type { Logger } from "@/framework/views/logger.js";

// ---------------------------------------------------------------------------
// Workspace (domains/workspace/)
// ---------------------------------------------------------------------------

/**
 * An orchestrator in this application: the framework's signature with
 * Praxis's context bound in, so a domain writes `Orchestrator<Options>`
 * and never repeats the context type.
 */
export type Orchestrator<Options = NoOptions> = BaseOrchestrator<CommandContext, Options>;

/**
 * Overrides for a CommandContext. Both default to a fresh instance, so a
 * test can point a context at a tmpdir or collect its diagnostics.
 */
export interface CommandContextOptions {
  paths?: Paths;
  logger?: Logger;
  out?: Display;
}

/** What assembling a project's health report needs. */
export interface BuildStatusReportInput {
  root: string;
  config: PraxisConfig;
}

/** What `praxis config show` renders: the file's location and its raw contents. */
export interface ShowConfigResult {
  configPath: string;
  config: unknown;
}

/** Content types `praxis add` can scaffold. */
export type AddableType = "expert" | "practice";

/** Options every eval invocation shares. */
export interface EvalInvocationOptions {
  /** Run only this reviewer (default: all configured reviewers). */
  reviewer?: string;
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
   * Cached verdict counts across all spec targets, one row per reviewer —
   * reviewers are separate instruments and are never silently pooled.
   * Empty when no reviewers are configured.
   */
  validation: {
    /** The reviewer's name, or null for the un-namespaced legacy cache. */
    reviewer: string | null;
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

// ---------------------------------------------------------------------------
// Service payloads (domains/workspace/services/)
// ---------------------------------------------------------------------------

/** Where documents are looked for, and what never counts as one. */
export interface DocumentScope {
  /** Project root all relative paths resolve against. */
  root: string;
  /** Filename or glob identifying spec files, which are not documents. */
  specFilePattern: string;
  /** Ignore patterns, relative to the root. */
  ignore?: string[];
}

/** One directory to list documents in. */
export interface ListDocumentsInput extends DocumentScope {
  /** Absolute directory path; a missing directory yields nothing. */
  dir: string;
  /** Whether to descend into subdirectories. */
  recursive: boolean;
}

/** The source trees to classify documents across. */
export interface CountDocumentsInput extends DocumentScope {
  /** Source directories, relative to the project root. */
  sources: string[];
}

/** How many documents of each non-authored kind a project holds. */
export interface DocumentCounts {
  references: number;
  context: number;
}

/** The practices to check for orphans, and what references exist. */
export interface FindOrphanedPracticesInput {
  /** Absolute paths to the practice files. */
  practiceFiles: string[];
  /** Project-relative paths some expert points at. */
  referenced: Set<string>;
  /** Project root the practice paths are made relative to. */
  root: string;
}

/** The practices to check ownership on, and the aliases that exist. */
export interface FindUnmatchedOwnersInput {
  /** Absolute paths to the practice files. */
  practiceFiles: string[];
  /** Lowercased alias to the expert file declaring it. */
  aliases: Map<string, string>;
}

/** A project whose cached verdicts should be counted. */
export interface TallyValidationInput {
  /** Project root the cache and targets resolve against. */
  root: string;
  /** The project's config: reviewers, sources, spec pattern, ignores. */
  config: PraxisConfig;
}

/** The experts to audit, and the project they live in. */
export interface AuditExpertsInput {
  /** Absolute paths to the expert files. */
  expertFiles: string[];
  /** Project root all references resolve against. */
  root: string;
  /** Filename or glob identifying spec files, never a reference target. */
  specFilePattern: string;
}

// ---------------------------------------------------------------------------
// Orchestrator payloads (domains/workspace/orchestrators/)
// ---------------------------------------------------------------------------

/** What scaffolding a new project needs to know. */
export interface InitProjectOptions {
  /** Directory to scaffold into, as typed; resolved against cwd. */
  directory: string;
  /** Scaffold source tree; defaults to the packaged one. */
  scaffoldDir?: string;
  /** Whether to add the spec-layer authoring taxonomy (11: opt-in). */
  specLayer?: boolean;
  /** Called with each created file's path, relative to the target. */
  onFileCreated?: (path: string) => void;
}

/** What scaffolding produced. */
export interface InitProjectResult {
  /** Files written. */
  created: number;
  /** Files left alone because they already existed. */
  skipped: number;
  /** Guidance to show the author, matched to what was scaffolded. */
  nextSteps: string[];
}
