import type { ReviewAllResult, ReviewProjectInput } from "@/eval/types.js";

import buildReviewScope from "@/eval/services/build-review-scope-service.js";
import reviewAll from "@/eval/services/review-all-service.js";
import selectReviewers from "@/eval/services/select-reviewers-service.js";

/**
 * Reviews everything a project's config covers.
 *
 * The projection every full run needs, in one place: config to scope,
 * configured reviewers to the selected ones. `reviewAll` stays the engine
 * and keeps taking a scope and reviewers outright, so a test can fan out
 * across arbitrary reviewers without writing a config file.
 *
 * @throws PraxisError when no reviewer is usable, or `type` matches no
 *   discovered domain
 */
export default async function reviewProjectService({
  root,
  config,
  reviewer,
  type,
  failFast = false,
  useCache = true,
  onProgress,
}: ReviewProjectInput): Promise<ReviewAllResult> {
  return reviewAll({
    ...buildReviewScope({ root, config }),
    reviewers: selectReviewers({ configured: config.reviewers, only: reviewer }),
    type,
    failFast,
    useCache,
    onProgress,
  });
}
