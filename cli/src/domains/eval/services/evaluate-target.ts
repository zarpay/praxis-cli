import type { EvaluateTargetInput, EvaluateTargetResult } from "@/domains/eval/types.js";

import judgeTarget from "@/domains/eval/services/judge-target.js";

/**
 * A verdict for one target, from cache when the inputs are unchanged.
 *
 * The cache-aware entry point both the full run and single-target
 * judging use, so the read/call/write sequence exists once. `cacheHit`
 * comes back with the verdict rather than being asked for afterwards,
 * and `usage` is null on a hit because nothing was spent.
 *
 * @param cache - Judge-namespaced cache, or null to always call
 * @throws PraxisError from `judgeTarget` on a cache miss
 */
export default async function evaluateTarget({
  target,
  judge,
  cache,
  root,
}: EvaluateTargetInput): Promise<EvaluateTargetResult> {
  const contentHash = target.contentHash();

  if (cache) {
    const cached = cache.read({
      targetPath: target.targetPath,
      contentHash,
      specPath: target.specPath,
    });

    if (cached) {
      return { verdict: cached, cacheHit: true, usage: null };
    }
  }

  const { verdict, usage } = await judgeTarget(target, judge, root);

  cache?.write({
    targetPath: target.targetPath,
    contentHash,
    result: verdict,
    metadata: { specPath: target.specPath, ...target.assistProvenance() },
  });

  return { verdict, cacheHit: false, usage };
}
