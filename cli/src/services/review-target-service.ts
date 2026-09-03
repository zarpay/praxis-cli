import type { ReviewTargetInput, ReviewTargetResult, Service } from "@/types.js";

import requestVerdictService from "@/services/request-verdict-service.js";

/**
 * A verdict for one target, from cache when the inputs are unchanged.
 *
 * The cache-aware entry point both the full run and single-target
 * reviewing use, so the read/call/write sequence exists once. `cacheHit`
 * comes back with the verdict rather than being asked for afterwards,
 * and `usage` is null on a hit because nothing was spent.
 *
 * @param cache - Reviewer-namespaced cache, or null to always call
 * @throws PraxisError from `requestVerdictService` on a cache miss
 */
const reviewTargetService: Service<ReviewTargetInput, Promise<ReviewTargetResult>> = async (
  cfg,
  { target, reviewer, cache },
) => {
  const contentHash = target.contentHash();

  if (cache) {
    const cached = cache.readVerdict({
      targetPath: target.targetPath,
      specPath: target.specPath,
      contentHash,
    });

    if (cached) {
      return { verdict: cached, cacheHit: true, usage: null };
    }
  }

  const { verdict, usage } = await requestVerdictService(cfg, { target, reviewer });

  if (cache) {
    cache.writeVerdict({
      targetPath: target.targetPath,
      specPath: target.specPath,
      contentHash,
      result: verdict,
      ...target.assistProvenance(),
    });
  }

  return { verdict, cacheHit: false, usage };
};

export default reviewTargetService;
