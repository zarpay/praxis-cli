import type { CacheJudgeIdentity, JudgeConfig } from "@/types.js";

import { createHash } from "node:crypto";

import {
  DEFAULT_JUDGE_BASE_URL,
  DEFAULT_JUDGE_PROVIDER,
  DEFAULT_JUDGE_TEMPERATURE,
} from "@/core/config.js";
import promptSurface from "@/domains/eval/prompts/prompt-surface.js";

/**
 * Judge identity hashing.
 *
 * The judge hash answers one question: would this judge produce the
 * same verdicts? It keys the cache namespace, so it is also the epoch
 * boundary (02, 05) — every input added here is a category of config
 * edit that becomes a hard break in longitudinal data.
 *
 * The contract is exclusion-based so it survives config-shape changes:
 * the entire judge object is hashed canonically, minus the declared
 * non-behavioral fields. A future setting added to JudgeConfig joins
 * the hash automatically — the fail-safe direction, since the worst
 * case is a spurious re-judgment, never a stale verdict served across
 * a real behavior change.
 */

/**
 * Fields that never affect judgments and are excluded from the hash:
 * `name` is a human label (renames must not invalidate verdicts) and
 * `apiKeyEnvVar` is a credential pointer (key rotation must not break
 * epochs). Everything else is behavioral by default.
 */
const NON_BEHAVIORAL_FIELDS = ["name", "apiKeyEnvVar"] as const;

/**
 * Computes the 8-character identity hash for a judge.
 *
 * Defaults are materialized before hashing, so an omitted setting and
 * its explicit default produce the same identity. The complete prompt
 * surface (src/eval/prompts/prompt-surface.ts) joins the hash directly
 * — a Praxis release that rewords any judge-facing prompt text changes
 * the judge as much as a model swap, with no version constant to
 * forget bumping.
 *
 * @param judge - The configured judge
 * @param prompts - Overridable for tests; defaults to the real prompt surface
 */
export function judgeHash(judge: JudgeConfig, prompts: string = promptSurface()): string {
  const behavioral: Record<string, unknown> = { ...judge };

  for (const field of NON_BEHAVIORAL_FIELDS) {
    delete behavioral[field];
  }

  behavioral["options"] ??= {};
  behavioral["promptSurface"] = prompts;
  behavioral["baseUrl"] ??= DEFAULT_JUDGE_BASE_URL;
  behavioral["provider"] ??= DEFAULT_JUDGE_PROVIDER;
  behavioral["temperature"] ??= DEFAULT_JUDGE_TEMPERATURE;

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

/**
 * The cache-facing identity of a judge: its behavioral hash plus the
 * human-readable name and model recorded alongside cached verdicts.
 */
export function cacheIdentity(judge: JudgeConfig): CacheJudgeIdentity {
  return { name: judge.name, model: judge.model, hash: judgeHash(judge) };
}
