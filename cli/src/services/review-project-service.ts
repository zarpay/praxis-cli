import type { ReviewAllResult, ReviewProjectInput, Service } from "@/types.js";

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
const reviewProjectService: Service<ReviewProjectInput, Promise<ReviewAllResult>> = async (
  cfg,
  { reviewer, type, failFast = false, useCache = true, ledger = true, onProgress },
) => {
  const reviewers = selectReviewersService(cfg, { only: reviewer });

  return reviewAllService(cfg, {
    reviewers,
    type,
    failFast,
    useCache,
    ledger,
    onProgress,
  });
};

export default reviewProjectService;
