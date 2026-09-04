// The documented contracts third parties implement: review providers
// (execution backends) and compiler plugins (output targets).
// Implementations live in src/providers/ and src/plugins/.

import type { PluginConfigEntry } from "@/types/config.js";
import type { Verdict } from "@/types/review.js";
import type { AgentMetadata } from "@/types/spec-layer.js";
import type { Logger } from "@framework/views/logger.js";

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

/** One raw tool-call completion, before any domain parsing. */
export interface ProviderCompletion {
  toolName: string;
  /** The tool call's arguments, JSON-parsed but not validated. */
  args: unknown;
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

/**
 * What a local provider module's default export must be. Factories are
 * invoked per resolution and must return stateless providers.
 */
export type ReviewProviderFactory = () => ReviewProvider;

/** The usage block OpenAI-compatible chat completions may return. */
export interface ChatCompletionUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  /** OpenRouter usage accounting's cost in USD. */
  cost?: number;
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
export interface CompilerPluginOptions {
  /** Project root the plugin resolves output paths against. */
  root: string;
  /** Logger for plugin diagnostics. */
  logger: Logger;
  /** Per-plugin configuration from config.json. */
  pluginConfig?: PluginConfigEntry;
}
