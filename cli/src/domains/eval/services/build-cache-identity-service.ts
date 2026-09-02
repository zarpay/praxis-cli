import type { CacheReviewerIdentity } from "@/domains/eval/types.js";
import type { ReviewerConfig } from "@/types.js";

import reviewerHash from "@/domains/eval/services/hash-reviewer-service.js";

/**
 * The cache-facing identity of a reviewer: its behavioral hash plus the
 * human-readable name and model recorded alongside cached verdicts.
 */
export default function cacheIdentity(reviewer: ReviewerConfig): CacheReviewerIdentity {
  return { name: reviewer.name, model: reviewer.model, hash: reviewerHash(reviewer) };
}
