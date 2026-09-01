import type { ReviewerConfig } from "@/types.js";

import { errors } from "@/core/errors.js";

/**
 * The reviewers a run should use, checked before any work begins.
 *
 * Three failures, all caught here rather than partway through a run
 * that costs API calls: no reviewers configured at all, a `--reviewer`
 * naming one that is not configured, and a reviewer whose API key
 * variable is unset.
 *
 * @param only - A reviewer name to narrow to; omitted uses all of them
 * @throws PraxisError naming what is wrong and what is available
 */
export default function selectReviewers({
  configured,
  only,
}: {
  configured: ReviewerConfig[];
  only?: string;
}): ReviewerConfig[] {
  if (configured.length === 0) {
    throw errors.missingReviewers();
  }

  const selected = only ? configured.filter((reviewer) => reviewer.name === only) : configured;

  if (selected.length === 0) {
    throw errors.unknownReviewer(
      only!,
      configured.map((reviewer) => reviewer.name),
    );
  }

  for (const reviewer of selected) {
    if (!process.env[reviewer.apiKeyEnvVar]) {
      throw errors.missingApiKey(reviewer.apiKeyEnvVar);
    }
  }

  return selected;
}
