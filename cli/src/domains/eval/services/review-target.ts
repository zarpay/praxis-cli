import type { ReviewTargetInput, ReviewTargetResult } from "@/domains/eval/types.js";

import requestVerdict from "@/domains/eval/services/request-verdict.js";

/**
 * A verdict for one target, from cache when the inputs are unchanged.
 *
 * The cache-aware entry point both the full run and single-target
 * reviewing use, so the read/call/write sequence exists once. `cacheHit`
 * comes back with the verdict rather than being asked for afterwards,
 * and `usage` is null on a hit because nothing was spent.
 *
 * @param cache - Reviewer-namespaced cache, or null to always call
 * @throws PraxisError from `requestVerdict` on a cache miss
 */
export default async function reviewTarget({
  target,
  reviewer,
  cache,
  root,
}: ReviewTargetInput): Promise<ReviewTargetResult> {
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

  const { verdict, usage } = await requestVerdict(target, reviewer, root);

  cache?.write({
    targetPath: target.targetPath,
    contentHash,
    result: verdict,
    metadata: { specPath: target.specPath, ...target.assistProvenance() },
  });

  return { verdict, cacheHit: false, usage };
}
