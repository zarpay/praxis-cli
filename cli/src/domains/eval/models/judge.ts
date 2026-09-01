import type { CacheJudgeIdentity } from "@/domains/eval/types.js";
import type { JudgeConfig } from "@/types.js";

import { errors } from "@/core/errors.js";
import cacheIdentity from "@/domains/eval/services/build-cache-identity.js";
import judgeHash from "@/domains/eval/services/hash-judge.js";
import {
  DEFAULT_JUDGE_BASE_URL,
  DEFAULT_JUDGE_PROVIDER,
  DEFAULT_JUDGE_TEMPERATURE,
} from "@/domains/workspace/models/praxis-config.js";

/**
 * A configured judge: who is evaluating, and with what settings.
 *
 * Holds the configuration and the helpers on it — the resolved
 * defaults, the behavioral hash, the cache identity, the API key
 * lookup. It performs no judgment itself; `requestVerdict()` does that,
 * taking a Judge as its instrument.
 *
 * Defaults are materialized here so every reader sees the same values
 * the hash was computed over. `judgeHash` materializes the same
 * defaults independently (`services/judge-hash.ts`), which is what lets
 * an omitted setting and its explicit default hash identically.
 */
export class Judge {
  /** The judge's name in config; not part of its behavioral identity. */
  readonly name: string;
  /** Model identifier the provider backend understands. */
  readonly model: string;
  /** Environment variable holding this judge's API key. */
  readonly apiKeyEnvVar: string;
  /** OpenAI-compatible endpoint base. */
  readonly baseUrl: string;
  /** Sampling temperature for judgments. */
  readonly temperature: number;
  /** Registry name or `./relative` module path of the execution backend. */
  readonly provider: string;
  /** Provider-specific options, passed through verbatim. */
  readonly options: Record<string, unknown>;

  /** The configuration exactly as written, which the hash is taken over. */
  readonly config: JudgeConfig;

  private constructor(config: JudgeConfig) {
    this.config = config;
    this.name = config.name;
    this.model = config.model;
    this.apiKeyEnvVar = config.apiKeyEnvVar;
    this.baseUrl = config.baseUrl ?? DEFAULT_JUDGE_BASE_URL;
    this.temperature = config.temperature ?? DEFAULT_JUDGE_TEMPERATURE;
    this.provider = config.provider ?? DEFAULT_JUDGE_PROVIDER;
    this.options = config.options ?? {};
  }

  /** Builds a judge from its configuration entry. */
  static fromConfig(config: JudgeConfig): Judge {
    return new Judge(config);
  }

  /**
   * This judge's behavioral hash: the whole config minus `name` and
   * `apiKeyEnvVar`, plus the judge-facing prompt surface.
   *
   * Changing it is an epoch change (05) — old verdicts miss, new ones
   * are written under the new key.
   */
  hash(): string {
    return judgeHash(this.config);
  }

  /** The identity recorded alongside this judge's cached verdicts. */
  cacheIdentity(): CacheJudgeIdentity {
    return cacheIdentity(this.config);
  }

  /**
   * This judge's API key, read from the environment at call time.
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
