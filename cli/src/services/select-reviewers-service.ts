import type { ReviewerConfig, Service } from "@/types.js";

import { errors } from "@/helpers/errors-helper.js";

/** How a run narrows the configured reviewers. */
interface SelectReviewersInput {
  /** A reviewer name to narrow to; omitted uses all of them. */
  only?: string;
}

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
const selectReviewersService: Service<SelectReviewersInput, ReviewerConfig[]> = (cfg, { only }) => {
  const configured = cfg.reviewers;

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
};

export default selectReviewersService;
