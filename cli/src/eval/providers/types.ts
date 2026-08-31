import type { Verdict } from "@/eval/cache-manager.js";

/**
 * The judge provider contract.
 *
 * A provider turns one fully-prepared judgment request into a
 * normalized verdict plus normalized usage. OpenRouter is merely the
 * default provider; a judge config can name any built-in provider or
 * point at a local ESM module implementing this contract
 * (`provider: "./praxis-providers/my-llm.js"`).
 */

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
