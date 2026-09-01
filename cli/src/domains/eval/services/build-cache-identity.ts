import type { CacheJudgeIdentity } from "@/domains/eval/types.js";
import type { JudgeConfig } from "@/types.js";

import judgeHash from "@/domains/eval/services/hash-judge.js";

/**
 * The cache-facing identity of a judge: its behavioral hash plus the
 * human-readable name and model recorded alongside cached verdicts.
 */
export default function cacheIdentity(judge: JudgeConfig): CacheJudgeIdentity {
  return { name: judge.name, model: judge.model, hash: judgeHash(judge) };
}
