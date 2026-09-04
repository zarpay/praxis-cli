import type { CacheReviewerIdentity } from "@/types.js";
import type { ReviewerConfig } from "@/types.js";

import { createHash } from "node:crypto";

import { errors } from "@/helpers/errors-helper.js";
import {
  DEFAULT_REVIEWER_BASE_URL,
  DEFAULT_REVIEWER_PROVIDER,
  DEFAULT_REVIEWER_TEMPERATURE,
} from "@/models/praxis-config.js";
import promptSurface from "@/prompts/prompt-surface.js";

/**
 * A configured reviewer: who is reviewing, and with what settings.
 *
 * Holds the configuration and the helpers on it — the resolved
 * defaults, the behavioral hash, the cache identity, the API key
 * lookup. It performs no review itself; `requestVerdict()` does that,
 * taking a Reviewer as its instrument.
 *
 * Defaults are materialized here so every reader sees the same values
 * the hash was computed over. `behavioralHash` materializes the same
 * defaults independently, which is what lets an omitted setting and
 * its explicit default hash identically.
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
    return behavioralHash(this.config);
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
      throw errors.missingApiKey(this.apiKeyEnvVar);
    }

    return key;
  }
}

/**
 * Reviewer identity hashing.
 *
 * The reviewer hash answers one question: would this reviewer produce the
 * same verdicts? It keys the cache namespace, so it is also the epoch
 * boundary (02, 05) — every input added here is a category of config
 * edit that becomes a hard break in longitudinal data.
 *
 * The contract is exclusion-based so it survives config-shape changes:
 * the entire reviewer object is hashed canonically, minus the declared
 * non-behavioral fields. A future setting added to ReviewerConfig joins
 * the hash automatically — the fail-safe direction, since the worst
 * case is a spurious re-review, never a stale verdict served across
 * a real behavior change.
 */

/**
 * Fields that never affect reviews and are excluded from the hash:
 * `name` is a human label (renames must not invalidate verdicts) and
 * `apiKeyEnvVar` is a credential pointer (key rotation must not break
 * epochs). Everything else is behavioral by default.
 */
const NON_BEHAVIORAL_FIELDS = ["name", "apiKeyEnvVar"] as const;

/**
 * Computes the 8-character identity hash for a reviewer.
 *
 * Defaults are materialized before hashing, so an omitted setting and
 * its explicit default produce the same identity. The complete prompt
 * surface (src/prompts/prompt-surface.ts) joins the hash directly — a
 * Praxis release that rewords any reviewer-facing prompt text changes
 * the reviewer as much as a model swap, with no version constant to
 * forget bumping.
 */
function behavioralHash(reviewer: ReviewerConfig): string {
  const behavioral: Record<string, unknown> = { ...reviewer };

  for (const field of NON_BEHAVIORAL_FIELDS) {
    delete behavioral[field];
  }

  behavioral["options"] ??= {};
  behavioral["promptSurface"] = promptSurface();
  behavioral["baseUrl"] ??= DEFAULT_REVIEWER_BASE_URL;
  behavioral["provider"] ??= DEFAULT_REVIEWER_PROVIDER;
  behavioral["temperature"] ??= DEFAULT_REVIEWER_TEMPERATURE;

  return createHash("sha256").update(canonicalize(behavioral)).digest("hex").slice(0, 8);
}

/**
 * Serializes a value deterministically: JSON with object keys sorted
 * recursively, so key insertion order never affects the hash.
 */
function canonicalize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `${JSON.stringify(key)}:${canonicalize(val)}`);
    return `{${entries.join(",")}}`;
  }

  return JSON.stringify(value);
}
