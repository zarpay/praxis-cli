import type { ReviewTargetInput, ReviewTargetResult } from "@/eval/types.js";

import readVerdict from "@/eval/services/read-verdict-service.js";
import requestVerdict from "@/eval/services/request-verdict-service.js";
import writeVerdict from "@/eval/services/write-verdict-service.js";

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
    const cached = readVerdict({
      cache,
      targetPath: target.targetPath,
      specPath: target.specPath,
      contentHash,
    });

    if (cached) {
      return { verdict: cached, cacheHit: true, usage: null };
    }
  }

  const { verdict, usage } = await requestVerdict(target, reviewer, root);

  if (cache) {
    writeVerdict({
      cache,
      targetPath: target.targetPath,
      specPath: target.specPath,
      contentHash,
      result: verdict,
      ...target.assistProvenance(),
    });
  }

  return { verdict, cacheHit: false, usage };
}
