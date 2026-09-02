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

import type { CommandContext } from "@/models/command-context.js";
import type { PraxisConfig } from "@/models/praxis-config.js";
import type { Paths } from "@/models/project-paths.js";
import type { ReviewSubject } from "@/models/review-subject.js";
import type { Reviewer } from "@/models/reviewer.js";
import type { VerdictCache } from "@/models/verdict-cache.js";
import type { NoOptions, Orchestrator as BaseOrchestrator } from "@framework/types.js";
import type { Display } from "@framework/views/display.js";
import type { Logger } from "@framework/views/logger.js";
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

/** What the Claude Code plugin supplies to the manifest template. */
export interface PluginManifestVars {
  /** The plugin's name in the manifest (`claudeCodePluginName`). */
  name: string;
}

/** What `praxis add practice` supplies to the practice document template. */
export interface PracticeTemplateVars {
  /** Display title, e.g. "Review Pull Requests". */
  title: string;
}

/** Machine-readable code, one per factory method on `errors`. */
export type PraxisErrorCode =
  | "ROOT_NOT_FOUND"
  | "INVALID_CONFIG_JSON"
  | "UNKNOWN_PLUGIN"
  | "UNKNOWN_DOCUMENT_TYPE"
  | "INVALID_DOCUMENT_TYPE"
  | "EDITOR_FAILED"
  | "FILE_ALREADY_EXISTS"
  | "SPEC_NOT_FOUND"
  | "MISSING_PROJECT_ROOT"
  | "MISSING_FRONTMATTER_FIELD"
  | "INVALID_FRONTMATTER_FIELD"
  | "EXPERT_NOT_FOUND"
  | "DOCUMENT_NOT_FOUND"
  | "INVALID_REVIEWER_CONFIG"
  | "UNKNOWN_REVIEWER"
  | "REVIEWERS_NOT_CONFIGURED"
  | "API_KEY_NOT_SET"
  | "REVIEWER_API_ERROR"
  | "UNKNOWN_REVIEW_PROVIDER"
  | "REVIEW_PROVIDER_LOAD_FAILED"
  | "INVALID_REVIEW_PROVIDER"
  | "REVIEW_PROVIDER_FAILED"
  | "NO_TOOL_CALL"
  | "UNEXPECTED_TOOL_CALL";

// ---------------------------------------------------------------------------
// Eval (was eval/types.ts)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Prompt inputs (domains/eval/prompts/)
// ---------------------------------------------------------------------------

/**
 * A file inlined into the review input beyond the target itself:
 * its display path and content. Exemplars and context files are both
 * this shape (03).
 */
export interface AssistFile {
  path: string;
  content: string;
}

/** Everything the reviewer's user prompt is built from. */
export interface ValidationQuestionInput {
  /** The spec content the target is reviewed against. */
  specContent: string;
  /** The review input: one file's content, or an assembled cohort. */
  targetContent: string;
  /** Path of the file, or of the cohort's directory. */
  targetPath: string;
  /** Whether the target is one file or a pre-assembled cohort of files. */
  kind: "file" | "cohort";
  /** Spec-blessed positive examples, inlined and never reviewed. */
  exemplars: readonly AssistFile[];
  /** Assist-only reference files, inlined and never reviewed. */
  context: readonly AssistFile[];
}

// ---------------------------------------------------------------------------
// Review input (eval/review-input.ts)
// ---------------------------------------------------------------------------

/** A spec's resolved assist inputs, one list per frontmatter key. */
export interface AssistInputs {
  /** Spec-blessed positive examples — shielded from adverse review. */
  exemplars: AssistFile[];
  /** Assist-only context — informs the review, never receives a verdict. */
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

/** Result of a single review, as stored in cache. */
export interface Verdict {
  /** Whether the target satisfies its spec. */
  compliant: boolean;
  /** Specific deviations reported by the reviewer (empty when compliant). */
  issues: string[];
  /** The reviewer's overall explanation of the verdict. */
  reason: string;
  /** Present only when non-compliant: warning or error. */
  severity?: Severity;
}

/** Identity of the reviewer whose verdicts a VerdictCache addresses. */
export interface CacheReviewerIdentity {
  name: string;
  model: string;
  hash: string;
}

/**
 * One stored verdict inside a target's cache file, carrying enough
 * reviewer provenance to be read by a human in the committed JSON.
 */
export interface VerdictEntry {
  reviewer: CacheReviewerIdentity;
  spec_path: string;
  cached_at: string;
  content_hash: string;
  /** Resolved exemplar files the reviewer saw, with content hashes (present when the spec blesses any). */
  exemplar_files?: AssistFileRecord[];
  /** Resolved context files the reviewer saw, with content hashes (present when the spec declares any). */
  context_files?: AssistFileRecord[];
  result: Verdict;
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
    spec_path: string;
  };
  result: Verdict;
}

// ---------------------------------------------------------------------------
// Reviewer providers (eval/providers/)
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
  /** The resolved API key from the reviewer's apiKeyEnvVar. */
  apiKey: string;
  /** The reviewer's free-form `options`, with provider-defined semantics. */
  options: Record<string, unknown>;
}

/** What a provider returns for one review. */
export interface ProviderResult {
  /** The normalized verdict praxis caches and reports. */
  verdict: Verdict;
  /** Normalized usage, or null when the backend reported none at all. */
  usage: ProviderUsage | null;
}

/**
 * The backend a reviewer runs on: named, stateless, one request at a time.
 *
 * `reviewer` is a noun in this codebase — the configured instrument. The
 * action is `review`, which is what a provider does for it.
 */
export interface ReviewProvider {
  /** Identifier used in error context (e.g. "openrouter", or a module path). */
  readonly name: string;
  /** Obtains one verdict for a fully-prepared request. */
  review(request: ProviderRequest): Promise<ProviderResult>;
}

/**
 * What a local provider module's default export must be. Factories are
 * invoked per resolution and must return stateless providers.
 */
export type ReviewProviderFactory = () => ReviewProvider;

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
// The eval run (eval/eval-run.ts)
// ---------------------------------------------------------------------------

/**
 * One review unit: what receives a single verdict.
 *
 * Under `by_file` (the default) a unit is one file and `path` is that
 * file. Under `by_directory` a unit is a directory matched by the
 * spec's `paths:` patterns, `path` is the directory, and `files` are
 * every file it contains — reviewed together as one input.
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
  /** How targets group into review units. */
  cohort: CohortMode;
  /**
   * Structural exclusions from the spec's `excludes:` frontmatter,
   * resolved to absolute glob patterns. Excluded files never become
   * units and never enter cohort membership — the reviewer never sees
   * them (03: prevention beats calibration).
   */
  excludes: string[];
  /**
   * Spec-blessed positive examples from `exemplars:`, resolved to
   * absolute glob patterns. Shielded from adverse review the same way
   * excludes are; the Reviewer inlines them into the prompt as positives.
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
  /** Name of the reviewer that produced this verdict. */
  reviewer: string;
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
   * Per-reviewer breakdown. Reviewers are instruments with different error
   * rates; their series render separately, never silently pooled (07).
   */
  byReviewer: Record<
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
// Service payloads (domains/eval/services/)
// ---------------------------------------------------------------------------

/** Where targets are looked for, and what never counts as one. */
export interface DiscoveryScope {
  /** Project root all patterns resolve against. */
  root: string;
  /** Source directories scanned for spec files, relative to the root. */
  sources: string[];
  /** Filename or glob identifying spec files, which are never targets. */
  specFilePattern?: string;
  /** Ignore patterns, already resolved to absolute paths. */
  absoluteIgnore?: string[];
}

/** A spec's assist inputs to resolve, and where to resolve them. */
export interface ResolveAssistInputsInput {
  /** The spec's raw content. */
  specContent: string;
  /** Used to name the spec when no root is available. */
  specPath: string;
  /** Project root the root-relative globs resolve against. */
  root?: string;
}

/** One unit of a full run: the target, its spec, and who reviews it. */
export interface ReviewUnitInput {
  /** The unit to review — one file, or a cohort of them. */
  unit: EvalUnit;
  /** The spec governing this unit. */
  specPath: string;
  /** The domain type the unit belongs to, for the summary. */
  type: string;
  /** The reviewer doing the work. */
  reviewerConfig: ReviewerConfig;
  /** This reviewer's cache, or null when the cache is disabled. */
  cache: VerdictCache | null;
  /** Project root. */
  root: string;
  /** Filename or glob naming spec files. */
  specFilePattern: string;
  /** Called as the review progresses, for streamed output. */
  onProgress?: (event: EvalProgress) => void;
}

/** One target to review, with the reviewer and cache to do it. */
export interface ReviewTargetInput {
  /** What is being reviewed, already resolved. */
  target: ReviewSubject;
  /** The instrument doing the reviewing. */
  reviewer: Reviewer;
  /** Reviewer-namespaced cache, or null to always call the provider. */
  cache: VerdictCache | null;
  /** Project root, for resolving a `./relative` provider. */
  root?: string;
}

/** A verdict, and how it was obtained. */
export interface ReviewTargetResult {
  verdict: Verdict;
  /** Whether it came from cache rather than a provider call. */
  cacheHit: boolean;
  /** Usage from the provider call, or null on a cache hit. */
  usage: ProviderUsage | null;
}

// ---------------------------------------------------------------------------
// Orchestrator payloads (domains/eval/orchestrators/)
// ---------------------------------------------------------------------------

/** What a run needs to know to review a project. */
/** What reviewing a whole project needs: its root, its config, and the run's options. */
export interface ReviewProjectInput {
  root: string;
  config: PraxisConfig;
  /** Run only this configured reviewer; omitted runs all of them. */
  reviewer?: string;
  /** Review only the domains of this type; omitted reviews everything. */
  type?: string;
  /** Whether to stop at the first error verdict. */
  failFast?: boolean;
  /** Whether to consult the verdict cache. */
  useCache?: boolean;
  /** Called as the run progresses, for streamed output. */
  onProgress?: (event: EvalProgress) => void;
}

export interface ReviewAllInput extends DiscoveryScope {
  /** The reviewers to run; every reviewer reviews every unit. */
  reviewers: ReviewerConfig[];
  /** Whether to consult the verdict cache. */
  useCache?: boolean;
  /** Whether to stop at the first error verdict. */
  failFast?: boolean;
  /** Review only the domains of this type; omitted reviews everything. */
  type?: string;
  /** Called as the run progresses, for streamed output. */
  onProgress?: (event: EvalProgress) => void;
}

/** What is happening, as a run happens. */
export type EvalProgress =
  | {
      kind: "unit-start";
      /** 1-based position across the whole run, reviewers included. */
      index: number;
      total: number;
      path: string;
      /** Member count when the unit is a cohort, undefined for a file. */
      cohortSize?: number;
      /** The reviewer's name, only when more than one reviewer is running. */
      reviewerName?: string;
    }
  | { kind: "verdict"; verdict: Verdict }
  | { kind: "unit-error"; message: string };

/** Everything a completed run produced. */
export interface ReviewAllResult {
  /** One verdict per (unit, reviewer), in the order they were reviewed. */
  verdicts: TargetVerdict[];
  /** Aggregated counts across the whole run. */
  summary: EvalSummary;
  /** Cache hits and misses accumulated over the run. */
  cacheStats: { hits: number; misses: number };
  /** Whether fail-fast stopped the run before every unit was reviewed. */
  stoppedEarly: boolean;
}

// ---------------------------------------------------------------------------
// Verdict cache payloads (domains/eval/services/)
// ---------------------------------------------------------------------------

/** A cached verdict to look up. */
export interface ReadVerdictInput {
  /** Where this reviewer's verdicts live. */
  cache: VerdictCache;
  /** The target whose verdict is wanted. */
  targetPath: string;
  /** The spec it was reviewed against. */
  specPath: string;
  /** Hash of the full review input; a mismatch is a miss. */
  contentHash: string;
}

/** A stored verdict to read back for reporting. */
export interface ReadVerdictEntryInput {
  /** Where this reviewer's verdicts live. */
  cache: VerdictCache;
  /** The target whose entry is wanted. */
  targetPath: string;
  /** The spec to read; omitted takes this reviewer's first entry. */
  specPath?: string;
}

/** A verdict to store, with the provenance of what produced it. */
export interface WriteVerdictInput {
  /** Where this reviewer's verdicts live. */
  cache: VerdictCache;
  /** The target that was reviewed. */
  targetPath: string;
  /** The spec it was reviewed against. */
  specPath: string;
  /** Hash of the full review input this verdict is keyed on. */
  contentHash: string;
  /** The verdict itself. */
  result: Verdict;
  /** Resolved exemplar provenance, recorded when the spec blesses any. */
  exemplarFiles?: AssistFileRecord[];
  /** Resolved context provenance, recorded when the spec declares any. */
  contextFiles?: AssistFileRecord[];
}

/** The targets to review, and the project they live in. */
export interface ReviewNamedInput {
  /** Absolute or cwd-relative target paths. */
  targets: string[];
  /** Project root. */
  root: string;
  /** The project's config: reviewers and spec pattern. */
  config: PraxisConfig;
  /** Spec override; honored only when exactly one target was named. */
  spec?: string;
  /** Narrow to one configured reviewer by name. */
  reviewer?: string;
  /** Whether to consult the verdict cache. */
  useCache?: boolean;
  /** Called with each verdict as it lands, for streamed output. */
  onVerdict?: (event: { path: string; verdict: Verdict; reviewerName?: string }) => void;
}

/** What reviewing the named targets produced. */
export interface ReviewNamedResult {
  /** Targets whose worst verdict was an error. */
  errors: number;
  /** Targets whose worst verdict was a warning. */
  warnings: number;
}

/** One target to report cached verdicts for. */
export interface CollectVerdictReportsInput {
  /** The target to report on. */
  targetPath: string;
  /** Project root. */
  root: string;
  /** The project's config: reviewers and spec pattern. */
  config: PraxisConfig;
}

/** Every reviewer's last recorded opinion of one target. */
export interface CollectVerdictReportsResult {
  /** The resolved absolute target path. */
  targetPath: string;
  /** Whether reviewers should be named in the output. */
  named: boolean;
  /** One report per configured reviewer, in config order. */
  reports: { reviewer: string; report: VerdictReport }[];
}

/** A cached verdict to classify. */
export interface BuildVerdictReportInput {
  /** The target the verdict is about. */
  targetPath: string;
  /** What the cache holds, or null when it holds nothing. */
  cacheData: CacheFileData | null;
  /** Filename or glob identifying spec files. */
  specFilePattern: string;
  /**
   * Project root the spec's assist globs resolve against.
   *
   * Without it, a spec declaring `context:` or `exemplars:` cannot be
   * rehashed, and the staleness check is skipped rather than guessed.
   */
  root?: string;
}

/** How `praxis eval run` and `praxis eval ci` were invoked. */
export interface RunEvalOptions {
  /** Targets named on the command line; empty means a full run. */
  targets?: string[];
  /** Restrict a full run to one domain type. */
  type?: string;
  /** Run only this configured reviewer. */
  reviewer?: string;
  /** Spec path for a single named target. */
  spec?: string;
  /** Show each verdict's full reasoning. */
  verbose?: boolean;
  /** Stop a full run at the first error verdict. */
  failFast?: boolean;
  /** Whether to consult the verdict cache. */
  cache?: boolean;
}

/** How `praxis eval ci` was invoked. */
export interface CiRunOptions {
  /** Count warnings as failures alongside errors. */
  strict?: boolean;
}

/** What `praxis eval verdict` was asked for. */
export interface ReportVerdictsOptions {
  /** The target whose cached verdicts to show. */
  target: string;
  /** Show each verdict's full reasoning. */
  verbose?: boolean;
}

// ---------------------------------------------------------------------------
// Spec (was spec/types.ts)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Spec layer (domains/spec/)
// ---------------------------------------------------------------------------

/** The reference keys an expert can point at other documents with. */
export type RefKey = "practices" | "context" | "refs";

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
  validates: string[];
  /** How validated targets group into review units (written as cohort: in output). */
  cohort?: string;
  /** Glob patterns structurally excluded from review (written as excludes: in output). */
  excludes: string[];
  /** Spec-blessed positive examples (written as exemplars: in output). */
  exemplars: string[];
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
// Service payloads (domains/spec/services/)
// ---------------------------------------------------------------------------

/** Where glob patterns are resolved, and what never counts as a match. */
export interface ExpandGlobsInput {
  /** Patterns to expand, in the order the author declared them. */
  patterns: string[];
  /** Project root the patterns resolve against. */
  root: string;
  /** Filename or glob identifying spec files, which are never matched. */
  specFilePattern?: string;
}

/** What one declared pattern turned out to match. */
export interface GlobExpansion {
  /** The pattern as the author wrote it. */
  pattern: string;
  /** Whether it is a glob; a plain path matches only itself. */
  isGlob: boolean;
  /** Project-relative paths matched, sorted. */
  matches: string[];
}

/** The content blocks a compiled profile is assembled from. */
export interface BuildProfileInput {
  /** The expert's own prose. */
  role: string;
  /** Practice bodies, inlined. */
  responsibilities: string[];
  /** Constitution bodies, inlined. */
  constitution: string[];
  /** Context bodies, inlined. */
  context: string[];
  /** Reference bodies, inlined. */
  reference: string[];
}

/** Inlined content plus anything the author should know went wrong. */
export interface InlineReferencesResult {
  /** Body text of every resolved file, in declaration order. */
  bodies: string[];
  /** Author-facing problems: a glob that matched nothing, a missing file. */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Orchestrator payloads (domains/spec/orchestrators/)
// ---------------------------------------------------------------------------

/** What compiling needs to know about the project it is compiling in. */
export interface CompileScope {
  /** Project root all relative paths resolve against. */
  root: string;
  /** Where pure profiles are written, or null to skip them. */
  agentProfilesOutputDir: string | null;
  /** Filename or glob identifying spec files, which are never compiled. */
  specFilePattern: string;
  /** The enabled output plugins, already constructed. */
  plugins: CompilerPlugin[];
}

/** One expert to compile. */
export interface CompileExpertInput extends CompileScope {
  /** Absolute path to the expert markdown file. */
  expertFile: string;
}

/**
 * One compiled profile and where it should go.
 *
 * `agentProfilesOutputDir` is already resolved: null means no profile
 * output. The raw config spells that `false`; `PraxisConfig` resolves
 * it, and nothing past that boundary should see the other spelling.
 */
export interface WriteProfileOutputsInput {
  /** The assembled profile markdown. */
  profile: string;
  /** Agent metadata, or null when the expert declares no description. */
  metadata: AgentMetadata | null;
  /** The expert's alias, which names the output file. */
  alias: string;
  /** Resolved profile output directory, or null to skip it. */
  agentProfilesOutputDir: string | null;
  /** The enabled output plugins, already constructed. */
  plugins: CompilerPlugin[];
}

/** What compiling one expert produced. */
export interface CompileExpertResult {
  /** The expert's alias, and the compiled file's basename. */
  alias: string;
  /** Author-facing problems encountered while inlining content. */
  warnings: string[];
}

/** Every expert in a directory. */
export interface CompileExpertsInput extends CompileScope {
  /** Directory holding the expert markdown files. */
  expertsDir: string;
  /** Called as each expert resolves, for streamed output. */
  onProgress?: (event: CompileProgress) => void;
}

/** What happened to one expert during a full compile. */
export type CompileProgress =
  | { kind: "compiled"; alias: string }
  | { kind: "skipped"; file: string; reason: string }
  | { kind: "warning"; message: string };

/** What a full compile produced. */
export interface CompileExpertsResult {
  /** How many experts compiled successfully. */
  compiled: number;
  /** Experts that could not be compiled, with the reason. */
  skipped: { file: string; reason: string }[];
}

/** One expert to compile, named by its alias. */
export interface CompileByAliasInput extends CompileScope {
  /** The alias to compile, matched case-insensitively. */
  alias: string;
  /** Directory holding the expert markdown files. */
  expertsDir: string;
}

/** A watch session over a project's source directories. */
export interface WatchAndCompileInput extends CompileExpertsInput {
  /** Source directories to watch, relative to the project root. */
  sources: string[];
  /** How long to wait for a burst of changes to settle. */
  debounceMs?: number;
  /** Called once per directory as watching begins. */
  onWatch?: (sourceDir: string) => void;
  /** Called when a change triggers a recompile. */
  onRecompile?: (filename: string | null) => void;
  /** Called when a recompile fails; the watch continues regardless. */
  onError?: (message: string) => void;
}

/** How `praxis compile` was invoked. */
export interface CompileProjectOptions {
  /** Compile only the expert with this alias. */
  alias?: string;
  /** Keep running, recompiling on every source change. */
  watch?: boolean;
}

/** What `praxis add expert|practice <name>` was given. */
export interface AddDocumentOptions {
  /** Kebab-case name for the new file, e.g. "code-reviewer". */
  name: string;
}

/** Everything scaffolding one document needs. */
export interface AddDocumentInput {
  /** Which template to use. */
  type: "expert" | "practice";
  /** Kebab-case name for the new file. */
  name: string;
  /** Project root the reported path is relative to. */
  root: string;
  /** Where experts live. */
  expertsDir: string;
  /** Where practices live. */
  practicesDir: string;
}

/** What was created. */
export interface AddDocumentResult {
  type: "expert" | "practice";
  /** The new file's path, relative to the project root. */
  path: string;
}

// ---------------------------------------------------------------------------
// Workspace (was workspace/types.ts)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Workspace (domains/workspace/)
// ---------------------------------------------------------------------------

/**
 * An orchestrator in this application: the framework's signature with
 * Praxis's context bound in, so a caller writes `Orchestrator<Options>`
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

/** A scaffold tree to copy into a project. */
export interface CopyScaffoldInput {
  /** The scaffold subtree to copy from. */
  sourceDir: string;
  /** The project directory to copy into. */
  targetDir: string;
}

/** What one scaffold copy did. */
export interface CopyScaffoldResult {
  /** Paths written, relative to the target. */
  created: string[];
  /** Files left alone because they already existed. */
  skipped: number;
}

/** What scaffolding produced. */
export interface InitProjectResult {
  /** Paths written, relative to the new project. */
  created: string[];
  /** Files left alone because they already existed. */
  skipped: number;
  /** Guidance to show the author, matched to what was scaffolded. */
  nextSteps: string[];
}

// ---------------------------------------------------------------------------
// View data (views/)
// ---------------------------------------------------------------------------

/** What an eval run announces before it starts. */
export interface EvalHeadline {
  /** Named targets; empty or omitted means a full run. */
  targets?: string[];
  /** CI framing. */
  ci?: boolean;
  /** A full run narrowed to one document type. */
  type?: string;
}

/** A completed full run, ready to report. */
export interface FinishedRun {
  run: ReviewAllResult;
  /** Whether the cache was consulted — a disabled cache is not a cold one. */
  cached: boolean;
}

/** One named target's verdict, as it lands. */
export interface ReviewedTarget {
  path: string;
  verdict: Verdict;
  /** Set only when more than one reviewer ran. */
  reviewerName?: string;
  /** Show the full reasoning. */
  verbose: boolean;
}

/** Every reviewer's cached report on one target. */
export interface ReviewerReports {
  reports: { reviewer: string; report: VerdictReport }[];
  /** Name each reviewer — only when several could disagree. */
  named: boolean;
  /** Show the full reasoning. */
  verbose: boolean;
}

/** The project whose verdict cache is being pruned. */
export interface PruneCacheInput {
  root: string;
  config: PraxisConfig;
}

/** What a prune removed. */
export interface PruneCacheResult {
  /** Entries dropped because no configured reviewer owns their hash. */
  entriesPruned: number;
  /** Files deleted: emptied by pruning, or unreadable/outdated outright. */
  filesRemoved: number;
}

/** What a finished compile reports: a full count, or one alias's outcome. */
export type CompileOutcome = { compiled: number } | { alias: string; warnings: string[] };

/** One event from a compile watch session. */
export type WatchEvent =
  { kind: "watching"; dir: string } | { kind: "recompiling"; filename: string | null };
