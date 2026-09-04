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

import type { AxiomFile } from "@/models/axiom-file.js";
import type { CommandContext } from "@/models/command-context.js";
import type { PraxisConfig } from "@/models/praxis-config.js";
import type { Paths } from "@/models/project-paths.js";
import type { ReviewSubject } from "@/models/review-subject.js";
import type { Reviewer } from "@/models/reviewer.js";
import type { VerdictStore } from "@/stores/verdict-store.js";
import type { NoOptions, Orchestrator as BaseOrchestrator } from "@framework/types.js";
import type { Display } from "@framework/views/display.js";
import type { Logger } from "@framework/views/logger.js";
import type { Prompter } from "@framework/views/prompter.js";
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

/**
 * The curator: the model that organizes triage, runs the authoring
 * gate, and assists ratification traceability (04). One entry, no name
 * — there is exactly one taxonomy librarian, and teams typically point
 * it at a frontier model. Reviewer-shaped so it rides the same provider
 * plumbing.
 */
export type CuratorConfig = Omit<ReviewerConfig, "name">;

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

/** Config shape after defaults are applied. */
export interface NormalizedConfig {
  agentProfilesOutputDir: string | false;
  plugins: PluginConfigEntry[];
  sources: string[];
  ignore: string[];
  expertsDir: string;
  practicesDir: string;
  reviewers: ReviewerConfig[];
  /** Null until configured; triage/gate/audit refuse without it. */
  curator: CuratorConfig | null;
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
  | "UNEXPECTED_TOOL_CALL"
  | "AXIOM_NOT_FOUND"
  | "CURATOR_NOT_CONFIGURED"
  | "CURATOR_MISSING_FIELD"
  | "PROVIDER_CANNOT_COMPLETE"
  | "NOT_A_TTY";

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

/**
 * One active axiom as the reviewer's checklist carries it (04): the
 * ratified standard with its full teaching material, so the reviewer
 * judges against the extension, not just a label.
 */
export interface ChecklistAxiom {
  id: string;
  version: number;
  severity: Severity;
  /** What the axiom asserts, one line for findings surfaces. */
  statement: string;
  /** Statement plus both examples, as authored. */
  body: string;
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
  /** The active axioms grounded in this spec — the checklist channel (04). */
  checklist: readonly ChecklistAxiom[];
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

/**
 * One reported deviation: the atomic unit of evidence (vocabulary).
 *
 * Born on one of the reviewer's two channels (04): matched critiques
 * carry the checklist axiom they are an instance of; open-channel
 * critiques carry null and flow onward to triage as open codes.
 */
export interface Critique {
  text: string;
  /** The checklist axiom it was born under; null = open channel. */
  axiomId: string | null;
  /** The matched axiom's version at review time; null on open channel. */
  axiomVersion: number | null;
}

/** Result of a single review, as stored in cache. */
export interface Verdict {
  /** Whether the target satisfies its spec. */
  compliant: boolean;
  /** Specific deviations reported by the reviewer (empty when compliant). */
  issues: Critique[];
  /** The reviewer's overall explanation of the verdict. */
  reason: string;
  /** Present only when non-compliant: warning or error. */
  severity?: Severity;
}

/** Identity of the reviewer whose verdicts a VerdictStore addresses. */
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
  review(request: ProviderRequest): Promise<ProviderResult>; /**
   * One raw structured-output call: the given tools, exactly one tool
   * call back. What the curator's prompts ride on (04). Optional — a
   * provider without it can review but cannot curate.
   */
  complete?(request: ProviderRequest): Promise<ProviderCompletion>;
}

/** One raw tool-call completion, before any domain parsing. */
export interface ProviderCompletion {
  toolName: string;
  /** The tool call's arguments, JSON-parsed but not validated. */
  args: unknown;
  usage: ProviderUsage | null;
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
  /** Set when the unit could not be reviewed at all (03): never a violation. */
  unverified?: true;
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
  /** Units that could not be reviewed at all — never counted as violations. */
  unverified: number;
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
  cache: VerdictStore | null;
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
  cache: VerdictStore | null;
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
export interface ReviewAllInput {
  /** Whether this run writes the ledger. Default true; CI passes false (12: verify without writing). */
  ledger?: boolean;
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

/** The targets to review, and the project they live in. */
export interface ReviewNamedInput {
  /** Whether this run writes the ledger. Default true; CI passes false (12: verify without writing). */
  ledger?: boolean;
  /** Absolute or cwd-relative target paths. */
  targets: string[];
  /** Spec override; honored only when exactly one target was named. */
  spec?: string;
  /** Narrow to one configured reviewer by name. */
  reviewer?: string;
  /** Whether to consult the verdict cache. */
  useCache?: boolean;
  /** Called once per target with its deduplicated findings (08). */
  onTarget?: (event: ReviewedTarget) => void;
}

/**
 * One deduplicated finding (vocabulary): what a developer or agent
 * works through. Matched critiques collapse to their axiom — one
 * finding, corroboration counted; open-channel critiques have no shared
 * identity yet, so each is its own finding until triage.
 */
export interface Finding {
  /** The axiom violated; null = open channel (raw critique). */
  axiomId: string | null;
  /** The axiom's statement (matched) or the critique text (open). */
  text: string;
  severity: Severity;
  /** Reviewer names that flagged it; more than one = corroboration (06). */
  witnesses: string[];
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

/** The glob patterns to resolve. */
export interface ExpandGlobsInput {
  /** Patterns to expand, in the order the author declared them. */
  patterns: string[];
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
export interface InlinedReferences {
  /** Body text of every resolved file, in declaration order. */
  bodies: string[];
  /** Author-facing problems: a glob that matched nothing, a missing file. */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Orchestrator payloads (domains/spec/orchestrators/)
// ---------------------------------------------------------------------------

/** What compiling needs to know about the project it is compiling in. */
export interface CompileExpertInput {
  /** Absolute path to the expert markdown file. */
  expertFile: string;
  /** The enabled output plugins, already constructed. */
  plugins: CompilerPlugin[];
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
export interface CompileExpertsInput {
  /** The enabled output plugins, already constructed. */
  plugins: CompilerPlugin[];
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

/** A watch session over a project's source directories. */
export interface WatchAndCompileInput extends CompileExpertsInput {
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
 * A service in this application: the project's config first — the one
 * scope object every layer may hold — then the work's own input. One
 * call shape across every service, mirroring `Orchestrator`; a service
 * with no input of its own is still called with `{}`, and one that
 * reads no project facts names its first parameter `_cfg`.
 */
export type Service<In, Out> = (cfg: PraxisConfig, input: In) => Out;

/** The input of a service that needs nothing beyond the config. */
export type NoInput = NoOptions;

/** The domain whose units to resolve. */
export interface ResolveUnitsInput {
  domain: ValidationDomain;
}

/** How a run narrows the configured reviewers. */
export interface SelectReviewersInput {
  /** A reviewer name to narrow to; omitted uses all of them. */
  only?: string;
}

/** The run records to segment into epochs. */
export interface DeriveEpochsInput {
  runs: LedgerRunRecord[];
}

/** The reviewers a boundary check covers — a run passes its selected subset. */
export interface DetectEpochBoundariesInput {
  reviewers: ReviewerConfig[];
}

/** The provider a reviewer declares. */
export interface ResolveProviderInput {
  /** A built-in registry name, or a ./relative local ESM module path. */
  spec: string;
}

/** The diagnostic channel plugin constructors receive. */
export interface ResolvePluginsInput {
  logger: Logger;
}

/**
 * Overrides for a CommandContext. Both default to a fresh instance, so a
 * test can point a context at a tmpdir or collect its diagnostics.
 */
export interface CommandContextOptions {
  paths?: Paths;
  logger?: Logger;
  out?: Display;
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
  /** Structural problems found in total — what maps to the exit code. */
  issueCount: number;
  /** The situational-poll facts an agent reads from one call (09-ae). */
  evalState: {
    pending_triage: number;
    proposals_pending: number;
    /** True until calibration exists (M6). */
    calibration_stale: boolean;
    epoch_boundary_detected: boolean;
    last_run_at: string | null;
  };
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

/** How many documents of each non-authored kind a project holds. */
export interface DocumentCounts {
  references: number;
  context: number;
}

/** The experts to audit. */
export interface AuditExpertsInput {
  /** Absolute paths to the expert files. */
  expertFiles: string[];
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
// The ledger (services/write-ledger-run-service.ts) — 05
// ---------------------------------------------------------------------------

/** What caused a ledger run (05). M2 writes only "manual". */
export type LedgerTrigger = "manual" | "ci" | "watch";

/** What a run covered (05). M2 writes "corpus" (full run) or "files" (named). */
export type LedgerScope = "corpus" | "diff" | "files";

/** Reviewer calibration state stamped on a run (06 grows this union). */
export type CalibrationStatus = "uncalibrated";

/** Verdict-diff classification of a critique (01). Null: no diff comparison existed. */
export type LedgerFlow = "introduced" | "inherited" | "resolved";

/**
 * One run record — one per (invocation, reviewer) — as stored.
 *
 * `reviewer_hash` goes beyond 05's field list deliberately: epochs are
 * promised to be derivable from provenance, and only the behavioral hash
 * sees a temperature, prompt, or options change. `baseline` is always
 * false until the epoch machinery exists (02).
 */
export interface LedgerRunRecord {
  kind: "run";
  run_id: string;
  timestamp: string;
  commit_sha: string | null;
  branch: string | null;
  trigger: LedgerTrigger;
  scope: LedgerScope;
  files_evaluated: number;
  reviewer_name: string;
  reviewer_model: string;
  reviewer_hash: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cost_usd: number | null;
  cache_hits: number;
  cache_misses: number;
  pass_count: number;
  warn_count: number;
  fail_count: number;
  unverified_count: number;
  critique_count: number;
  /**
   * Evaluated units per governing spec — the applicable-opportunity
   * denominator (07, added 2026-09-03). Absent on records written
   * before it existed; their per-run rates suppress as insufficient
   * data rather than padding.
   */
  spec_units?: Record<string, number>;
  calibration_status_at_run: CalibrationStatus;
  baseline: boolean;
}

/**
 * One critique record — one per issue — as stored.
 *
 * Fields no M2 run can know are typed literal `null`, so populating one
 * later is a visible type change, not a quiet drift. The enums a future
 * reader must understand (`population`, `authorship`, `flow`) carry their
 * full unions now, because old records outlive new code.
 */
export interface LedgerCritiqueRecord {
  kind: "critique";
  /** `${run_id}:${seq}`, 1-based in write order. */
  id: string;
  run_id: string;
  timestamp: string;
  /** Project-relative. */
  file_path: string;
  /** Project-relative. */
  spec_path: string;
  target_content_hash: string;
  spec_content_hash: string;
  reviewer_name: string;
  reviewer_model: string;
  reviewer_hash: string;
  severity: Severity;
  text: string;
  mode: "judgment";
  /** The checklist axiom the critique was born under; null = open channel. */
  axiom_id: string | null;
  axiom_version: number | null;
  /** How the assignment happened; "checklist" = born matched (04-t). */
  assigned_by: "checklist" | null;
  /** M2 writes "unknown" — never guessed (05). */
  population: "pre_spec" | "post_spec" | "unknown";
  /** M2 writes "unknown" — never guessed (02). */
  authorship: "agent" | "human" | "unknown";
  authorship_evidence: null;
  agent_involved: null;
  pre_review: null;
  /** Null in M2: working-tree runs are excluded from flow by rule (12). */
  flow: LedgerFlow | null;
  before_run_id: null;
  resolved_by: null;
}

/** Any line of a run file. */
export type LedgerRecord = LedgerRunRecord | LedgerCritiqueRecord;

/** What one review produced beyond its verdict — null when nothing was reviewed. */
export interface LedgerEvidence {
  /** Provider usage, or null on a cache hit. */
  usage: ProviderUsage | null;
  /** Absolute path of the spec the unit was reviewed against. */
  specPath: string;
  targetContentHash: string;
  specContentHash: string;
}

/** One reviewed unit as the ledger sees it. */
export interface LedgerEntry {
  /** The structural slice of a verdict the ledger reads. */
  verdict: {
    path: string;
    compliant: boolean;
    issues: Critique[];
    severity?: Severity;
    unverified?: true;
  };
  cacheHit: boolean;
  /** Null ⇒ the unit went unverified ⇒ it fans out no critiques. */
  evidence: LedgerEvidence | null;
}

/** One reviewer's completed run, ready to persist. */
export interface WriteLedgerRunInput {
  reviewer: CacheReviewerIdentity;
  trigger: LedgerTrigger;
  scope: LedgerScope;
  entries: LedgerEntry[];
  /** Evaluated units per governing spec, project-relative paths. */
  specUnits?: Record<string, number>;
}

/** Where a run landed. */
export interface WriteLedgerRunResult {
  runId: string;
  path: string;
}

/**
 * One reviewer whose behavioral hash the ledger has never seen — an
 * epoch boundary (02). Named from the most recent prior run so the
 * warning can say what changed.
 */
export interface EpochBoundary {
  reviewerName: string;
  currentHash: string;
  currentModel: string;
  previousHash: string;
  previousModel: string;
  /** Timestamp of the reviewer's most recent prior run. */
  lastRunTimestamp: string;
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

/** One named target's outcome: the worst verdict, and the finding list. */
export interface ReviewedTarget {
  path: string;
  /** The worst verdict across reviewers — the badge and the reason. */
  verdict: Verdict;
  /** Deduplicated across reviewers by (axiom, text) — what to work through. */
  findings: Finding[];
  /** How many reviewers ran, so witness counts read as fractions. */
  reviewerCount: number;
  /** Show the full reasoning. */
  verbose?: boolean;
}

/** Every reviewer's cached report on one target. */
export interface ReviewerReports {
  reports: { reviewer: string; report: VerdictReport }[];
  /** Name each reviewer — only when several could disagree. */
  named: boolean;
  /** Show the full reasoning. */
  verbose: boolean;
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

// ---------------------------------------------------------------------------
// Axioms (models/axiom-file.ts, the axiom store services)
// ---------------------------------------------------------------------------

/** An axiom's lifecycle state (04): proposed until ratified, never deleted. */
export type AxiomStatus = "proposed" | "active" | "deprecated";

/** How the axiom is evaluated (03); `agentic` is schema-only until built. */
export type AxiomMode = "judgment" | "agentic";

/**
 * What the reviewer reads to decide this axiom (03). The runtime honors
 * `file` and `file+context`; the rest are in the schema so nothing gets
 * silently stretched into them.
 */
export type AxiomScope = "hunk" | "file" | "file+context" | "cohort" | "changeset";

/** The fields the proposal template renders into an axiom file. */
export interface AxiomTemplateVars {
  id: string;
  status: AxiomStatus;
  mode: AxiomMode;
  scope: AxiomScope;
  severity: Severity;
  /** YYYY-MM-DD; per-axiom population clocks start here (04). */
  introduced: string;
  /** Spec traceability; null until ratification establishes it. */
  groundedIn: string | null;
  statement: string;
  violatingExample: string;
  compliantExample: string;
}

/** One unreadable file in a store sweep: reported, never fatal. */
export interface StoreProblem {
  path: string;
  message: string;
}

/** The store's contents, plus what could not be read. */
export interface ListAxiomsResult {
  /** Sorted by introduced date, id as tiebreak — random ids carry no order. */
  axioms: AxiomFile[];
  /** Files that failed validation: reported, never fatal to the sweep. */
  problems: StoreProblem[];
}

/** One axiom, shown in full. */
export interface ShownAxiom {
  axiom: AxiomFile;
}

/** One row of the gate re-assessment over active axioms (03). */
export interface AxiomAuditRow {
  id: string;
  assessment: string;
  reasoning: string;
}

/** The audit's advisory rows, for a human to act on. */
export interface AxiomAudit {
  rows: AxiomAuditRow[];
}

/** Everything the ratifier weighs before the human call (04). */
export interface RatifyReview {
  axiom: AxiomFile;
  /** How many assigned critiques back the proposal. */
  supportingCritiques: number;
  gate: GateAssessment;
  traceability: TraceabilityAssessment;
}

/** One cluster of a triage session, framed for its decision. */
export interface TriageClusterCard {
  /** 1-based position in the session. */
  index: number;
  total: number;
  cluster: TriageCluster;
  critiques: PendingCritique[];
}

/** A triage session's counted outcome. */
export interface TriageOutcome {
  assigned: number;
  proposed: number;
  dismissed: number;
  skipped: number;
  /** Open-channel critiques still waiting after the session. */
  pendingLeft: number;
  /** Curator spend across the session, or null when nothing reported. */
  costUsd: number | null;
}

/** Where the proposal landed. */
export interface WriteAxiomProposalResult {
  id: string;
  path: string;
}

/** Options for `praxis axioms list`. */
export interface ListAxiomsOptions {
  json?: boolean;
}

/** Options for `praxis axioms show <id>`. */
export interface ShowAxiomOptions {
  id: string;
  json?: boolean;
}

// ---------------------------------------------------------------------------
// Curator (04): triage organization, the authoring gate, traceability
// ---------------------------------------------------------------------------

/** One unassigned open-channel critique, as triage works it. */
export interface PendingCritique {
  id: string;
  runId: string;
  /** Project-relative, as the ledger records them. */
  filePath: string;
  specPath: string;
  severity: Severity;
  text: string;
  reviewerName: string;
}

/** A draft axiom the curator proposes from a critique cluster. */
export interface AxiomDraft {
  statement: string;
  severity: Severity;
  scope: AxiomScope;
  violatingExample: string;
  compliantExample: string;
  /** The spec passage the curator grounds the draft in — ratification's aid. */
  groundingHint: string;
}

/** What the curator suggests doing with one cluster; a human decides (04). */
export type TriageSuggestion =
  | { kind: "assign"; axiomId: string }
  | { kind: "propose"; draft: AxiomDraft }
  | { kind: "unassignable"; why: string };

/** One cluster of critiques the curator grouped, with its suggestion. */
export interface TriageCluster {
  critiqueIds: string[];
  rationale: string;
  suggestion: TriageSuggestion;
}

/** The curator's organization of one spec's pending critiques. */
export interface TriageOrganization {
  clusters: TriageCluster[];
  usage: ProviderUsage | null;
}

/** The authoring gate's verdict on one candidate axiom (03). */
export interface GateAssessment {
  assessment: "appropriate" | "not_appropriate" | "split";
  reasoning: string;
  /** On split: the judgment half, redrafted as the admissible statement. */
  judgmentHalf: string | null;
  usage: ProviderUsage | null;
}

/** The curator's spec-traceability aid at ratification (04). */
export interface TraceabilityAssessment {
  traceable: boolean;
  /** `<spec path>#<section>` when traceable. */
  grounding: string | null;
  /** The spec passage that grounds the axiom, quoted verbatim. */
  quotedBasis: string;
  reasoning: string;
  usage: ProviderUsage | null;
}

/** One curator call: rendered prompts and tools in, one tool call out. */
export interface RequestCuratorCompletionInput {
  systemPrompt: string;
  userPrompt: string;
  tools: readonly unknown[];
}

/** One spec's pending critiques, ready for the curator to organize. */
export interface OrganizeTriageInput {
  /** Project-relative spec path, as the critiques record it. */
  specPath: string;
  specContent: string;
  critiques: PendingCritique[];
  /** Established axioms the critiques may fold into: id + statement. */
  axioms: { id: string; statement: string }[];
}

/** One candidate axiom for the authoring gate (03). */
export interface AssessAxiomGateInput {
  statement: string;
  violatingExample: string;
  compliantExample: string;
}

/** One proposal to trace against its spec at ratification. */
export interface AssessTraceabilityInput {
  /** Project-relative spec path the proposal claims to belong to. */
  specPath: string;
  specContent: string;
  statement: string;
}

// ---------------------------------------------------------------------------
// Triage state (the ledger's triage partition)
// ---------------------------------------------------------------------------

/** A human decision folding one critique into an axiom (04-t). */
export interface TriageAssignmentRecord {
  kind: "assignment";
  critique_id: string;
  axiom_id: string;
  axiom_version: number;
  /** Both halves of the provenance: who decided, who suggested. */
  assigned_by: { decision: "human" | "flag:--yes"; suggested_by: string };
  timestamp: string;
}

/** A human decision that a critique is not evidence worth keeping. */
export interface TriageDismissalRecord {
  kind: "dismissal";
  critique_id: string;
  reason: string;
  timestamp: string;
}

/** A proposal rejected at ratification — reviewer-noise signal (04). */
export interface ProposalRejectionRecord {
  kind: "rejection";
  axiom_id: string;
  reason: string;
  timestamp: string;
}

/** Everything a triage session appends. */
export type TriageRecord = TriageAssignmentRecord | TriageDismissalRecord | ProposalRejectionRecord;

/** The triage tool's wire shape for one cluster, before validation. */
export interface TriageWireCluster {
  critique_ids?: string[];
  rationale?: string;
  suggestion?: string;
  axiom_id?: string | null;
  draft?: {
    statement?: string;
    severity?: string;
    scope?: string;
    violating_example?: string;
    compliant_example?: string;
    grounding_hint?: string;
  } | null;
  why_unassignable?: string | null;
}

/**
 * What git can attest about a run's anchoring (05, 12). `commitSha`
 * non-null means the reviewed disk state provably equals a named,
 * reviewable commit — reconstruction-grade evidence. Null inside a repo
 * means the run was feedback on a transient state: attested by content
 * hashes, not reproducible from git.
 */
export interface GitFacts {
  inRepo: boolean;
  commitSha: string | null;
  branch: string | null;
}

/** The derived triage queue and its residual counters. */
export interface TriageState {
  /** Open-channel critiques no assignment or dismissal covers yet. */
  pending: PendingCritique[];
  /** Every assignment on record — ratification reads a proposal's support here. */
  assignments: TriageAssignmentRecord[];
  dismissed: number;
  rejectedProposals: number;
}

/** What one interactive triage session accumulates as it walks clusters. */
export interface TriageSession {
  ctx: CommandContext;
  cfg: PraxisConfig;
  yes: boolean;
  prompter: Prompter;
  /** The curator model, recorded as the suggester in every assignment. */
  suggestedBy: string;
  records: TriageRecord[];
  assigned: number;
  proposed: number;
  dismissed: number;
  skipped: number;
  costUsd: number | null;
}

/** Options for `praxis axioms triage`. */
export interface TriageAxiomsOptions {
  /** Accept every curator suggestion without prompting. */
  yes?: boolean;
  /** Dismiss everything pending, with this reason. */
  reject?: string;
}

/** Options for `praxis axioms ratify <id>`. */
export interface RatifyAxiomOptions {
  id: string;
  yes?: boolean;
  reject?: string;
  /** Spec to trace against; needed only when no assigned critique names one. */
  spec?: string;
}

/** Options for `praxis axioms audit`. */
export interface AuditAxiomsOptions {
  json?: boolean;
}

// ---------------------------------------------------------------------------
// Measurement (M4): epochs, populations, rates, reports
// ---------------------------------------------------------------------------

/** One epoch: a maximal interval of stable reviewer behavior (02). */
export interface Epoch {
  reviewerHash: string;
  reviewerModel: string;
  /** Run ids in this epoch, in timestamp order. */
  runs: LedgerRunRecord[];
  /** The epoch-opening corpus run, when one exists (02: the baseline). */
  baseline: LedgerRunRecord | null;
  /** How this epoch was opened; null for a reviewer's first epoch. */
  openedBy: EpochBoundaryEvent | null;
}

/** A named epoch boundary — first-class in every report (07, rule 6). */
export interface EpochBoundaryEvent {
  /** "model → x/y" or "config or prompt surface changed". */
  label: string;
  /** Timestamp of the first run under the new hash. */
  at: string;
}

/** One reviewer's full epoch series, in first-seen order. */
export interface EpochSeries {
  reviewerName: string;
  epochs: Epoch[];
}

/** One file's population relative to one axiom's clock (01). */
export interface DerivePopulationInput {
  /** Project-relative, as critique records carry it. */
  filePath: string;
  /** The axiom's `introduced` date, YYYY-MM-DD. */
  axiomIntroduced: string;
  /** Shared memo across one report build. */
  birthdates: Map<string, string | null>;
}

/** One rate, floor-aware: rendered only with its denominator (07). */
export interface RateCell {
  numerator: number;
  denominator: number;
  /** Null when the cell is below the small-n floor. */
  rate: number | null;
  /** "3/41 (7.3%)" or "insufficient data (n<5)". */
  display: string;
}

/** What population a count is qualified by (01; unqualified is banned). */
export type PopulationQualifier = "pre_spec" | "post_spec" | "unknown";

/** How one report invocation is scoped (07's three levels + filters). */
export interface ReportScope {
  /** Glob or path over critique file_paths; null = everything. */
  target: string | null;
  /** ISO date floor on run timestamps; null = all time. */
  since: string | null;
  branch: string | null;
  /** Exact run commit shas; null = any. */
  commits: string[] | null;
  /** Shas that no longer resolve in this clone (12's note renders). */
  unresolvableShas: { sha: string; branch: string | null; at: string | null }[];
}

/** Everything `resolve-report-scope` needs to build a scope. */
export interface ResolveReportScopeInput {
  target?: string;
  since?: string;
  branch?: string;
  commit?: string;
  commits?: string[];
}

/** Ledger records after scoping: what a report computes over. */
export interface ScopedLedger {
  scope: ReportScope;
  runs: LedgerRunRecord[];
  critiques: LedgerCritiqueRecord[];
}

/** One axiom's row in the eval report, one reviewer's series (07 rule 7). */
export interface AxiomReportRow {
  axiomId: string;
  statement: string;
  severity: Severity;
  reviewerName: string;
  /** Violations over applicable opportunities, floor-aware. */
  rate: RateCell;
  /**
   * When the current stock was last evidenced: the anchor run's
   * timestamp, or null when no evidenced corpus run exists. An all-hit
   * run restates no critiques (05), so it never moves this.
   */
  asOf: string | null;
  /** Distinct files violating. */
  files: number;
  /** Violation counts by derived population (01). */
  byPopulation: Record<PopulationQualifier, number>;
  /** Epoch segments, oldest first — never charted across a boundary. */
  segments: { epochLabel: string; violations: number; runs: number }[];
}

/** The eval report payload — the stable `--json` contract (09). */
export interface EvalReport {
  scope: ReportScope;
  /** The core panel (07's three-level decision). */
  panel: {
    runs: number;
    critiques: number;
    filesTouched: number;
    reviewers: string[];
    specs: string[];
    costUsd: number | null;
    /** Run-indexed cost trend with calendar annotations (07 open q1). */
    costTrend: { runId: string; at: string; costUsd: number | null }[];
  };
  /** "uncalibrated" until M6; rendered on every report (07 rule 4). */
  calibration: string;
  axioms: AxiomReportRow[];
  /** Open-channel critiques with no assignment yet — the triage queue. */
  pendingTriage: number;
  /** Dismissed + rejected over all critiques, floor-aware (04). */
  residual: RateCell;
  epochs: EpochSeries[];
}

/** The single-axiom drill-down payload. */
export interface AxiomReport {
  axiomId: string;
  statement: string;
  status: AxiomStatus;
  severity: Severity;
  groundedIn: string | null;
  introduced: string;
  version: number;
  rows: AxiomReportRow[];
  /** Representative critiques, newest first, capped. */
  examples: { id: string; filePath: string; reviewerName: string; text: string }[];
}

/** One axiom's debt position in one reviewer's latest epoch. */
export interface DebtRow {
  axiomId: string;
  statement: string;
  reviewerName: string;
  /** (axiom, file) pairs violating at the epoch-opening baseline. */
  baselineStock: number;
  /** Violating at the latest corpus run of the epoch. */
  currentStock: number;
  /** In baseline, gone at latest — corpus-level paydown (02). */
  paydown: number;
  /** Absent at baseline, present at latest — labeled exactly this. */
  appearedSinceBaseline: number;
}

/** Paydown credit: the authors whose commits touched resolved files (02). */
export interface PaydownCredit {
  author: string;
  resolved: number;
}

/** The debt report payload. */
export interface DebtReport {
  calibration: string;
  /** When each reviewer's stock was last evidenced — the staleness facts. */
  evidence: { reviewerName: string; baselineAt: string; currentAt: string }[];
  rows: DebtRow[];
  /** Current-stock concentration by directory, worst first. */
  concentration: { directory: string; violations: number }[];
  credits: PaydownCredit[];
  /** Why credit may be missing. */
  creditNote: string | null;
  /** Stock movement across the last two baselines, boundary named (02). */
  rebaseline: { boundaryLabel: string; before: number; after: number } | null;
}

/** What the eval-report builder computes over. */
export interface BuildEvalReportInput {
  scoped: ScopedLedger;
}

/** The single-axiom drill-down's inputs. */
export interface BuildAxiomReportInput {
  scoped: ScopedLedger;
  axiomId: string;
}

/** Options for `praxis eval report`. */
export interface EvalReportOptions {
  target?: string;
  since?: string;
  branch?: string;
  commit?: string;
  commits?: string[];
  axiom?: string;
  json?: boolean;
}

/** Options for `praxis debt report`. */
export interface DebtReportOptions {
  json?: boolean;
}

/** Options for `praxis status`. */
export interface StatusOptions {
  json?: boolean;
}

/** What the orientation screen shows — bare `praxis` (09-h). */
export interface Orientation {
  lastRun: { at: string; reviewerName: string; anchored: boolean } | null;
  pendingTriage: number;
  proposalsPending: number;
  activeAxioms: number;
  calibration: string;
  /** Errors at the latest corpus run, per reviewer. */
  debtLine: { reviewerName: string; errors: number }[] | null;
}
