import type { ReviewTargetInput, ReviewTargetResult } from "@/types.js";

import readVerdictService from "@/services/read-verdict-service.js";
import requestVerdictService from "@/services/request-verdict-service.js";
import writeVerdictService from "@/services/write-verdict-service.js";

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
export default async function reviewTarget({
  target,
  reviewer,
  cache,
  root,
}: ReviewTargetInput): Promise<ReviewTargetResult> {
  const contentHash = target.contentHash();

  if (cache) {
    const cached = readVerdictService({
      cache,
      targetPath: target.targetPath,
      specPath: target.specPath,
      contentHash,
    });

    if (cached) {
      return { verdict: cached, cacheHit: true, usage: null };
    }
  }

  const { verdict, usage } = await requestVerdictService(target, reviewer, root);

  if (cache) {
    writeVerdictService({
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
