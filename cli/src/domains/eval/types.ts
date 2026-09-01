/**
 * The eval domain's vocabulary: what a review is made of, what comes
 * back, and how it is cached and reported.
 *
 * Shapes more than one domain needs live in src/types.ts instead —
 * ReviewerConfig among them, because core/config.ts normalizes it, and
 * CohortMode, which an expert declares and a spec honors.
 */

import type { ReviewSubject } from "@/domains/eval/models/review-subject.js";
import type { Reviewer } from "@/domains/eval/models/reviewer.js";
import type { CacheManager } from "@/domains/eval/services/verdict-cache.js";
import type { CohortMode, ReviewerConfig } from "@/types.js";

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

/** Identity of the reviewer whose verdicts a CacheManager reads and writes. */
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
 * v4.0 cache file: one file per target, holding every verdict for it —
 * all specs, all reviewers — keyed by `<specHash>:<reviewerHash>`.
 */
export interface CacheFile {
  version: "4.0";
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

/** One target to review, with the reviewer and cache to do it. */
export interface ReviewTargetInput {
  /** What is being reviewed, already resolved. */
  target: ReviewSubject;
  /** The instrument doing the reviewing. */
  reviewer: Reviewer;
  /** Reviewer-namespaced cache, or null to always call the provider. */
  cache: CacheManager | null;
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
export interface RunEvalInput extends DiscoveryScope {
  /** The reviewers to run; every reviewer reviews every unit. */
  reviewers: ReviewerConfig[];
  /** Whether to consult the verdict cache. */
  useCache?: boolean;
  /** Whether to stop at the first error verdict. */
  failFast?: boolean;
  /** Reviewer only the domains of this type; omitted reviewers everything. */
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
export interface RunEvalResult {
  /** One verdict per (unit, reviewer), in the order they were reviewed. */
  verdicts: TargetVerdict[];
  /** Aggregated counts across the whole run. */
  summary: EvalSummary;
  /** Cache hits and misses accumulated over the run. */
  cacheStats: { hits: number; misses: number };
  /** Whether fail-fast stopped the run before every unit was reviewed. */
  stoppedEarly: boolean;
}
