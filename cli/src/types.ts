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

import type { PraxisConfig } from "@/core/config.js";
import type { Display, Logger } from "@/core/logger.js";

// ---------------------------------------------------------------------------
// Terminal output (core/logger.ts)
// ---------------------------------------------------------------------------

/** Chalk styles a Display entry may name. */
export type LineColor = "green" | "yellow" | "red" | "blue" | "cyan" | "gray" | "dim" | "bold";

/** A line of text, optionally styled as a whole. */
export interface TextEntry {
  text: string;
  color?: LineColor;
}

/** A colored `[LABEL]` badge, optionally followed by a value and indented. */
export interface BadgeEntry {
  badge: string;
  color: LineColor;
  value?: string | number;
  indent?: number;
}

/** A title between two divider lines. */
export interface HeaderEntry {
  header: string;
  char?: string;
  width?: number;
}

/**
 * One renderable entry: a plain string, a structured entry, or a falsy
 * value to skip — so conditional entries inline naturally
 * (`count > 0 && { badge: ... }`).
 */
export type DisplayEntry =
  | string
  | TextEntry
  | BadgeEntry
  | HeaderEntry
  | null
  | false
  | undefined;

// ---------------------------------------------------------------------------
// Errors (core/errors.ts)
// ---------------------------------------------------------------------------

/** Machine-readable code, one per factory method on `errors`. */
export type PraxisErrorCode =
  | "ROOT_NOT_FOUND"
  | "INVALID_CONFIG_JSON"
  | "UNKNOWN_PLUGIN"
  | "UNKNOWN_DOCUMENT_TYPE"
  | "FILE_ALREADY_EXISTS"
  | "TEMPLATE_NOT_FOUND"
  | "SPEC_NOT_FOUND"
  | "MISSING_PROJECT_ROOT"
  | "INVALID_COHORT"
  | "EXPERT_NOT_FOUND"
  | "DOCUMENT_NOT_FOUND"
  | "INVALID_JUDGE_CONFIG"
  | "UNKNOWN_JUDGE"
  | "JUDGES_NOT_CONFIGURED"
  | "API_KEY_NOT_SET"
  | "JUDGE_API_ERROR"
  | "UNKNOWN_JUDGE_PROVIDER"
  | "JUDGE_PROVIDER_LOAD_FAILED"
  | "INVALID_JUDGE_PROVIDER"
  | "JUDGE_PROVIDER_FAILED"
  | "NO_TOOL_CALL"
  | "UNEXPECTED_TOOL_CALL";

// ---------------------------------------------------------------------------
// Configuration (core/config.ts)
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
 * One configured judge: a named inference backend that evaluates
 * targets against specs. Every configured judge evaluates every
 * target — n judges are n instruments running the same protocol.
 */
export interface JudgeConfig {
  /** Unique judge name; identifies its verdicts in results and reports. */
  name: string;
  /** Model identifier the backend understands (e.g. an OpenRouter slug). */
  model: string;
  /** Name of the environment variable holding the backend's API key. */
  apiKeyEnvVar: string;
  /** OpenAI-compatible endpoint base; defaults to OpenRouter. */
  baseUrl?: string;
  /** Sampling temperature for judgments; defaults to 0.1. */
  temperature?: number;
  /**
   * Provider that executes judgments: a built-in registry name, or a
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
  judges?: Partial<JudgeConfig>[];
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
  judges: JudgeConfig[];
  specFilePattern: string;
}

// ---------------------------------------------------------------------------
// Base classes (core/base.ts)
// ---------------------------------------------------------------------------

/** Shared plumbing every Praxis class accepts: injectable output surfaces. */
export interface PraxisBaseOptions {
  logger?: Logger;
  out?: Display;
}

/** Options for classes bound to a Praxis project. */
export interface PraxisProjectBaseOptions extends PraxisBaseOptions {
  /** Project root all paths resolve against. */
  root: string;
  /** Pre-loaded config; resolved lazily from root when omitted. */
  config?: PraxisConfig;
}

// ---------------------------------------------------------------------------
// Prompts (src/prompts/)
// ---------------------------------------------------------------------------

/**
 * A file inlined into the judgment input beyond the target itself:
 * its display path and content. Exemplars and context files are both
 * this shape (03).
 */
export interface AssistFile {
  path: string;
  content: string;
}

/** Everything the judge's user prompt is built from. */
export interface ValidationQuestionInput {
  /** The spec content the target is judged against. */
  specContent: string;
  /** The judgment input: one file's content, or an assembled cohort. */
  targetContent: string;
  /** Path of the file, or of the cohort's directory. */
  targetPath: string;
  /** Whether the target is one file or a pre-assembled cohort of files. */
  kind: "file" | "cohort";
  /** Spec-blessed positive examples, inlined and never judged. */
  exemplars: readonly AssistFile[];
  /** Assist-only reference files, inlined and never judged. */
  context: readonly AssistFile[];
}

// ---------------------------------------------------------------------------
// Judgment input (eval/judgment-input.ts)
// ---------------------------------------------------------------------------

/** A spec's resolved assist inputs, one list per frontmatter key. */
export interface AssistInputs {
  /** Spec-blessed positive examples — shielded from adverse judgment. */
  exemplars: AssistFile[];
  /** Assist-only context — informs the judgment, never receives a verdict. */
  context: AssistFile[];
}

/** Provenance record for one assist file as stored in a cache entry. */
export interface AssistFileRecord {
  path: string;
  hash: string;
}

// ---------------------------------------------------------------------------
// Verdicts and the cache (eval/cache-manager.ts)
// ---------------------------------------------------------------------------

/** Severity level for validation issues. */
export type Severity = "warning" | "error";

/** Result of a single judgment, as stored in cache. */
export interface Verdict {
  /** Whether the target satisfies its spec. */
  compliant: boolean;
  /** Specific deviations reported by the judge (empty when compliant). */
  issues: string[];
  /** The judge's overall explanation of the verdict. */
  reason: string;
  /** Present only when non-compliant: warning or error. */
  severity?: Severity;
}

/** Identity of the judge whose verdicts a CacheManager reads and writes. */
export interface CacheJudgeIdentity {
  name: string;
  model: string;
  hash: string;
}

/**
 * One stored verdict inside a target's cache file, carrying enough
 * judge provenance to be read by a human in the committed JSON.
 */
export interface VerdictEntry {
  judge: CacheJudgeIdentity;
  spec_path: string;
  target_type: string;
  cached_at: string;
  content_hash: string;
  /** Resolved exemplar files the judge saw, with content hashes (present when the spec blesses any). */
  exemplar_files?: AssistFileRecord[];
  /** Resolved context files the judge saw, with content hashes (present when the spec declares any). */
  context_files?: AssistFileRecord[];
  result: Verdict;
}

/**
 * v3.0 cache file: one file per target, holding every verdict for it —
 * all specs, all judges — keyed by `<specHash>:<judgeHash>`.
 */
export interface CacheFile {
  version: "3.0";
  verdicts: Record<string, VerdictEntry>;
}

/**
 * Cache data shape returned by readRaw() and readAllRaw().
 *
 * A flattened per-verdict view for report consumers.
 */
export interface CacheFileData {
  version: string;
  cached_at: string;
  content_hash: string;
  document: {
    path: string;
    type: string;
    spec_path: string;
  };
  result: Verdict;
}

/** Information about an orphaned (stale) cache file. */
export interface OrphanedCacheFile {
  file: string;
  reason: "document_missing";
  docName: string;
  type: string;
}

// ---------------------------------------------------------------------------
// Judge providers (eval/providers/)
// ---------------------------------------------------------------------------

/** Normalized usage accounting for one provider call. */
export interface ProviderUsage {
  /** Tokens in the prompt, or null when the backend doesn't report them. */
  promptTokens: number | null;
  /** Tokens in the completion, or null when the backend doesn't report them. */
  completionTokens: number | null;
  /** Cost in USD, or null when the backend doesn't report cost. */
  costUsd: number | null;
}

/**
 * Everything a provider needs to obtain one verdict.
 *
 * Prompts arrive fully rendered and tools fully specified — praxis
 * owns the prompt surface, and a provider never imports it. Defaults
 * (baseUrl, temperature) arrive materialized, and the API key arrives
 * resolved — providers never read process.env.
 */
export interface ProviderRequest {
  /** The rendered system prompt. */
  systemPrompt: string;
  /** The rendered user prompt (spec + assist sections + target). */
  userPrompt: string;
  /** The validation tool schemas (OpenAI function-tool format), passed through opaquely. */
  tools: readonly unknown[];
  /** Model identifier the backend understands. */
  model: string;
  /** Sampling temperature, default already applied. */
  temperature: number;
  /** Endpoint base URL, default already applied. */
  baseUrl: string;
  /** The resolved API key from the judge's apiKeyEnvVar. */
  apiKey: string;
  /** The judge's free-form `options`, with provider-defined semantics. */
  options: Record<string, unknown>;
}

/** What a provider returns for one judgment. */
export interface ProviderResult {
  /** The normalized verdict praxis caches and reports. */
  verdict: Verdict;
  /** Normalized usage, or null when the backend reported none at all. */
  usage: ProviderUsage | null;
}

/** A judge provider: named, stateless, and able to judge one request at a time. */
export interface JudgeProvider {
  /** Identifier used in error context (e.g. "openrouter", or a module path). */
  readonly name: string;
  /** Obtains one verdict for a fully-prepared request. */
  judge(request: ProviderRequest): Promise<ProviderResult>;
}

/**
 * What a local provider module's default export must be. Factories are
 * invoked per resolution and must return stateless providers.
 */
export type JudgeProviderFactory = () => JudgeProvider;

/** A tool call as OpenAI-compatible chat completions return it. */
export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

/** The usage block OpenAI-compatible chat completions may return. */
export interface ChatCompletionUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  /** OpenRouter usage accounting's cost in USD. */
  cost?: number;
}

/** The chat-completion response fields the OpenRouter provider reads. */
export interface ChatCompletionResponse {
  choices: {
    message: { role: string; content: string | null; tool_calls?: ToolCall[] };
  }[];
  usage?: ChatCompletionUsage;
}

// ---------------------------------------------------------------------------
// The judge (eval/judge.ts)
// ---------------------------------------------------------------------------

/** Known target types within the Praxis content structure. */
export type TargetType =
  | "expert"
  | "practice"
  | "reference"
  | "convention"
  | "constitution"
  | "template"
  | "unknown";

// ---------------------------------------------------------------------------
// The eval run (eval/eval-run.ts)
// ---------------------------------------------------------------------------

/** How a spec groups its targets into evaluation units. */
export type CohortMode = "by_file" | "by_directory";

/**
 * One evaluation unit: what receives a single verdict.
 *
 * Under `by_file` (the default) a unit is one file and `path` is that
 * file. Under `by_directory` a unit is a directory matched by the
 * spec's `paths:` patterns, `path` is the directory, and `files` are
 * every file it contains — judged together as one input.
 */
export interface EvalUnit {
  path: string;
  files: string[];
}

/** A validation domain: a spec file and the targets it validates. */
export interface ValidationDomain {
  /** Directory containing the spec file. */
  dir: string;
  /** Absolute path to the spec file. */
  specPath: string;
  /** Type label derived from the spec's directory (root-relative path). */
  type: string;
  /** How targets group into evaluation units. */
  cohort: CohortMode;
  /**
   * Structural exclusions from the spec's `excludes:` frontmatter,
   * resolved to absolute glob patterns. Excluded files never become
   * units and never enter cohort membership — the judge never sees
   * them (03: prevention beats calibration).
   */
  excludes: string[];
  /**
   * Spec-blessed positive examples from `exemplars:`, resolved to
   * absolute glob patterns. Shielded from adverse judgment the same way
   * excludes are; the Judge inlines them into the prompt as positives.
   */
  exemplars: string[];
  /** Explicit target files when the spec declares `paths:` (by_file). */
  targetFiles?: string[];
  /** Matched directories when the spec declares `cohort: by_directory`. */
  targetDirs?: string[];
}

/** Extended validation result that includes file path and type information. */
export interface TargetVerdict extends Verdict {
  /** Absolute path of the validated document. */
  path: string;
  /** Type label of the domain that validated it (spec directory, root-relative). */
  type: string;
  /** Basename of the validated document. */
  filename: string;
  /** Name of the judge that produced this verdict. */
  judge: string;
}

/** Aggregated validation summary across all documents. */
export interface EvalSummary {
  /** All documents seen: source .md docs plus any paths:-targeted files. */
  total: number;
  /** Documents whose result was compliant. */
  compliant: number;
  /** Non-compliant results with warning severity. */
  warnings: number;
  /** Non-compliant results with error severity. */
  errors: number;
  /** Documents no result covers (no spec, or skipped by fail-fast). */
  notValidated: number;
  /** Per-type breakdown, keyed by validation domain type label. */
  byType: Record<
    string,
    {
      total: number;
      compliant: number;
      issues: number;
    }
  >;
  /**
   * Per-judge breakdown. Judges are instruments with different error
   * rates; their series render separately, never silently pooled (07).
   */
  byJudge: Record<
    string,
    {
      compliant: number;
      warnings: number;
      errors: number;
    }
  >;
}

// ---------------------------------------------------------------------------
// Verdict reporting (eval/verdict-reporter.ts)
// ---------------------------------------------------------------------------

/** All possible report states. */
export type ReportStatus = "not_validated" | "pass" | "warn" | "fail" | "stale";

/** Structured report data for a single target. */
export interface VerdictReport {
  /** Path of the reported target. */
  targetPath: string;
  /** Overall status, with staleness taking priority over the cached verdict. */
  status: ReportStatus;
  /** The cached validation entry, or null if never validated. */
  cacheData: CacheFileData | null;
  /** Content hash of the target as it exists now, or null if uncomputable. */
  currentHash: string | null;
  /** Whether the target changed since the cached validation. */
  isStale: boolean;
}

// ---------------------------------------------------------------------------
// Spec layer (src/spec/)
// ---------------------------------------------------------------------------

/**
 * Metadata extracted from role frontmatter for agent compilation.
 *
 * Used by plugins to generate platform-specific output (e.g. Claude Code
 * frontmatter). The fields map to role frontmatter keys prefixed with `agent_`.
 */
export interface AgentMetadata {
  /** Agent name (lowercase, hyphenated). */
  name: string;
  /** Human-readable description of what the agent does. */
  description: string;
  /** Comma-separated list of allowed tools (e.g. "Read, Glob, Grep"). */
  tools?: string;
  /** Model to use (e.g. "opus"). */
  model?: string;
  /** Permission mode (e.g. "plan"). */
  permissionMode?: string;
  /** Glob patterns for files this profile validates (written as paths: in output). */
  validates?: string[];
  /** How validated targets group into evaluation units (written as cohort: in output). */
  cohort?: string;
  /** Glob patterns structurally excluded from judgment (written as excludes: in output). */
  excludes?: string[];
  /** Spec-blessed positive examples (written as exemplars: in output). */
  exemplars?: string[];
}

/**
 * Interface for output plugins that transform compiled agent profiles
 * into platform-specific formats.
 *
 * Each plugin receives the pure profile markdown and agent metadata,
 * then writes its output to the appropriate location.
 */
export interface CompilerPlugin {
  /** Plugin identifier (e.g. "claude-code"). */
  readonly name: string;

  /**
   * Compiles a pure agent profile into a platform-specific output file.
   *
   * @param profileContent - Pure markdown profile (no plugin-specific frontmatter)
   * @param metadata - Agent metadata from role frontmatter, or null if missing
   * @param alias - The role's alias (used for output file naming)
   */
  compile(profileContent: string, metadata: AgentMetadata | null, alias: string): void;
}

/** Options passed to plugin constructors. */
export interface PluginOptions {
  /** Project root the plugin resolves output paths against. */
  root: string;
  /** Logger for plugin diagnostics. */
  logger: Logger;
  /** Per-plugin configuration from config.json. */
  pluginConfig?: PluginConfigEntry;
}

/** Constructor signature every compiler plugin class must satisfy. */
export type PluginConstructor = new (options: PluginOptions) => CompilerPlugin;

// ---------------------------------------------------------------------------
// Commands (src/commands/)
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
