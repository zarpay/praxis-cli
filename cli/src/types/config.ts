// The config file's shape: what `.praxis/config.json` declares,
// raw and per-entry. `PraxisConfig` (a model) is the reader.

/** Config shape as it may appear on disk (all fields optional). */
export interface RawConfig {
  agentProfilesOutputDir?: string | false;
  plugins?: RawPluginEntry[];
  sources?: string[];
  ignore?: string[];
  expertsDir?: string;
  practicesDir?: string;
  reviewers?: Partial<ReviewerConfig>[];
  curator?: Partial<CuratorConfig>;
  /** Filename or glob pattern for spec files (default: "README.md"). */
  specFilePattern?: string;
}

/** Raw plugin entry as it appears in config JSON. */
export type RawPluginEntry = string | PluginConfigEntry;

/** Normalized plugin configuration entry. */
export interface PluginConfigEntry {
  /** Plugin identifier (e.g. "claude-code"). */
  name: string;
  /** Full path to plugin output dir, resolved against project root. */
  outputDir?: string;
  /** Name used in the Claude Code plugin.json file. Default: "praxis". */
  claudeCodePluginName?: string;
}

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

/**
 * The curator: the model that organizes triage, runs the authoring
 * gate, and assists ratification traceability (04). One entry, no name
 * — there is exactly one taxonomy librarian, and teams typically point
 * it at a frontier model. Reviewer-shaped so it rides the same provider
 * plumbing.
 */
export type CuratorConfig = Omit<ReviewerConfig, "name">;
