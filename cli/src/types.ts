/**
 * The project's single home for types and interfaces.
 *
 * Every type and interface lives here (ESLint-enforced: declarations
 * are banned elsewhere in src/), organized by domain from foundations
 * to surfaces. Classes, constants, and functions stay in their modules
 * — this file declares shapes, never behavior. The only imports are
 * type-only references to classes (erased at runtime), so any module
 * in any layer may import from `@/types.js`.
 *
 * One deliberate exception lives elsewhere: `core/files.ts` re-exports
 * node's `FSWatcher` type, because `node:fs` imports are walled into
 * that module.
 */
// ---------------------------------------------------------------------------
// Configuration (workspace/models/praxis-config.ts)
// ---------------------------------------------------------------------------

/** Normalized plugin configuration entry. */
export interface PluginConfigEntry {
  /** Plugin identifier (e.g. "claude-code"). */
  name: string;
  /** Full path to plugin output dir, resolved against project root. */
  outputDir?: string;
  /** Name used in the Claude Code plugin.json file. Default: "praxis". */
  claudeCodePluginName?: string;
}

/** Raw plugin entry as it appears in config JSON. */
export type RawPluginEntry = string | PluginConfigEntry;

/**
 * One configured reviewer: a named inference backend that reviews
 * targets against specs. Every configured reviewer reviews every
 * target — n reviewers are n instruments running the same protocol.
 */
export interface ReviewerConfig {
  /** Unique reviewer name; identifies its verdicts in results and reports. */
  name: string;
  /** Model identifier the backend understands (e.g. an OpenRouter slug). */
  model: string;
  /** Name of the environment variable holding the backend's API key. */
  apiKeyEnvVar: string;
  /** OpenAI-compatible endpoint base; defaults to OpenRouter. */
  baseUrl?: string;
  /** Sampling temperature for reviews; defaults to 0. */
  temperature?: number;
  /**
   * Provider that executes reviews: a built-in registry name, or a
   * ./relative ESM module path resolved from the project root whose
   * default export is a provider factory. Defaults to "openrouter".
   */
  provider?: string;
  /** Free-form settings passed through to the provider verbatim. */
  options?: Record<string, unknown>;
}

/** Config shape as it may appear on disk (all fields optional). */
export interface RawConfig {
  agentProfilesOutputDir?: string | false;
  plugins?: RawPluginEntry[];
  sources?: string[];
  ignore?: string[];
  expertsDir?: string;
  practicesDir?: string;
  reviewers?: Partial<ReviewerConfig>[];
  /** Filename or glob pattern for spec files (default: "README.md"). */
  specFilePattern?: string;
}

/** Config shape after defaults are applied. */
export interface NormalizedConfig {
  agentProfilesOutputDir: string | false;
  plugins: PluginConfigEntry[];
  sources: string[];
  ignore: string[];
  expertsDir: string;
  practicesDir: string;
  reviewers: ReviewerConfig[];
  specFilePattern: string;
}

/** How a spec groups its targets into review units. */
export type CohortMode = "by_file" | "by_directory";

// ---------------------------------------------------------------------------
// Templates (templates/)
// ---------------------------------------------------------------------------

/** What `praxis add expert` supplies to the expert document template. */
export interface ExpertTemplateVars {
  /** Display title, e.g. "Code Reviewer". */
  title: string;
  /** The alias the compiler keys the expert on — the name as typed. */
  alias: string;
}

/** What `praxis add practice` supplies to the practice document template. */
export interface PracticeTemplateVars {
  /** Display title, e.g. "Review Pull Requests". */
  title: string;
}
