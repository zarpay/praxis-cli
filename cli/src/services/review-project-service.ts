import type { ReviewAllResult, ReviewProjectInput } from "@/types.js";

import reviewAllService from "@/services/review-all-service.js";
import selectReviewersService from "@/services/select-reviewers-service.js";

/**
 * Reviews everything a project's config covers.
 *
 * The projection every full run needs, in one place: config to scope,
 * configured reviewers to the selected ones. `reviewAllService` stays the engine
 * and keeps taking a scope and reviewers outright, so a test can fan out
 * across arbitrary reviewers without writing a config file.
 *
 * @throws PraxisError when no reviewer is usable, or `type` matches no
 *   discovered domain
 */
export default async function reviewProjectService({
  config,
  reviewer,
  type,
  failFast = false,
  useCache = true,
  ledger = true,
  onProgress,
}: ReviewProjectInput): Promise<ReviewAllResult> {
  const scope = config.discoveryScope();
  const reviewers = selectReviewersService({ configured: config.reviewers, only: reviewer });

  return reviewAllService({
    ...scope,
    reviewers,
    type,
    failFast,
    useCache,
    ledger,
    onProgress,
  });
}
