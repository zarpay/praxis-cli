import type { CacheReviewerIdentity } from "@/eval/types.js";
import type { ReviewerConfig } from "@/types.js";

import reviewerHash from "@/eval/services/hash-reviewer-service.js";
import { errors } from "@/framework/errors.js";
import {
  DEFAULT_REVIEWER_BASE_URL,
  DEFAULT_REVIEWER_PROVIDER,
  DEFAULT_REVIEWER_TEMPERATURE,
} from "@/workspace/models/praxis-config.js";

/**
 * A configured reviewer: who is reviewing, and with what settings.
 *
 * Holds the configuration and the helpers on it — the resolved
 * defaults, the behavioral hash, the cache identity, the API key
 * lookup. It performs no review itself; `requestVerdict()` does that,
 * taking a Reviewer as its instrument.
 *
 * Defaults are materialized here so every reader sees the same values
 * the hash was computed over. `reviewerHash` materializes the same
 * defaults independently (`services/hash-reviewer.ts`), which is what lets
 * an omitted setting and its explicit default hash identically.
 */
export class Reviewer {
  /** The reviewer's name in config; not part of its behavioral identity. */
  readonly name: string;
  /** Model identifier the provider backend understands. */
  readonly model: string;
  /** Environment variable holding this reviewer's API key. */
  readonly apiKeyEnvVar: string;
  /** OpenAI-compatible endpoint base. */
  readonly baseUrl: string;
  /** Sampling temperature for reviews. */
  readonly temperature: number;
  /** Registry name or `./relative` module path of the execution backend. */
  readonly provider: string;
  /** Provider-specific options, passed through verbatim. */
  readonly options: Record<string, unknown>;

  /** The configuration exactly as written, which the hash is taken over. */
  readonly config: ReviewerConfig;

  private constructor(config: ReviewerConfig) {
    this.config = config;
    this.name = config.name;
    this.model = config.model;
    this.apiKeyEnvVar = config.apiKeyEnvVar;
    this.baseUrl = config.baseUrl ?? DEFAULT_REVIEWER_BASE_URL;
    this.temperature = config.temperature ?? DEFAULT_REVIEWER_TEMPERATURE;
    this.provider = config.provider ?? DEFAULT_REVIEWER_PROVIDER;
    this.options = config.options ?? {};
  }

  /** Builds a reviewer from its configuration entry. */
  static fromConfig(config: ReviewerConfig): Reviewer {
    return new Reviewer(config);
  }

  /**
   * This reviewer's behavioral hash: the whole config minus `name` and
   * `apiKeyEnvVar`, plus the reviewer-facing prompt surface.
   *
   * Changing it is an epoch change (05) — old verdicts miss, new ones
   * are written under the new key.
   */
  hash(): string {
    return reviewerHash(this.config);
  }

  /** The identity recorded alongside this reviewer's cached verdicts. */
  cacheIdentity(): CacheReviewerIdentity {
    return { name: this.name, model: this.model, hash: this.hash() };
  }

  /**
   * This reviewer's API key, read from the environment at call time.
   *
   * @throws PraxisError when the variable is unset or empty
   */
  apiKey(): string {
    const key = process.env[this.apiKeyEnvVar];

    if (!key) {
      throw errors.apiKeyNotSet(this.apiKeyEnvVar);
    }

    return key;
  }
}
