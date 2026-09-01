import type { ReviewNamedInput, ReviewNamedResult } from "@/domains/eval/types.js";

import { ReviewSubject } from "@/domains/eval/models/review-subject.js";
import { Reviewer } from "@/domains/eval/models/reviewer.js";
import { VerdictCache } from "@/domains/eval/models/verdict-cache.js";
import { worstVerdict } from "@/domains/eval/models/verdict.js";
import cacheIdentity from "@/domains/eval/services/build-cache-identity.js";
import reviewTarget from "@/domains/eval/services/review-target.js";
import selectReviewers from "@/domains/eval/services/select-reviewers.js";

/**
 * Reviews the named targets, each against its own spec.
 *
 * What `praxis eval run <targets…>` does. Every selected reviewer sees
 * every target, and each target's outcome is the worst verdict across
 * them — one error anywhere is an error.
 *
 * `spec` overrides spec discovery, and only when a single target was
 * named: pointing several targets at one spec would silently review
 * them against direction that does not govern them.
 *
 * @throws PraxisError when no reviewer is usable, or a target has no spec
 */
export default async function reviewNamed({
  targets,
  root,
  config,
  spec,
  reviewer: only,
  useCache = true,
  onVerdict,
}: ReviewNamedInput): Promise<ReviewNamedResult> {
  const reviewers = selectReviewers({ configured: config.reviewers, only });
  const specPath = targets.length === 1 ? spec : undefined;

  let errors = 0;
  let warnings = 0;

  for (const targetPath of targets) {
    const subject = ReviewSubject.resolve({
      targetPath,
      specPath,
      specFilePattern: config.specFilePattern,
      root,
    });

    const verdicts = [];

    for (const reviewerConfig of reviewers) {
      const { verdict } = await reviewTarget({
        target: subject,
        reviewer: Reviewer.fromConfig(reviewerConfig),
        cache: useCache
          ? new VerdictCache({ projectRoot: root, reviewer: cacheIdentity(reviewerConfig) })
          : null,
        root,
      });

      verdicts.push(verdict);
      onVerdict?.({
        path: targetPath,
        verdict,
        // Only worth naming the reviewer when more than one ran.
        reviewerName: reviewers.length > 1 ? reviewerConfig.name : undefined,
      });
    }

    const worst = worstVerdict(verdicts);

    if (worst && !worst.compliant && worst.severity === "error") errors++;

    if (worst && !worst.compliant && worst.severity === "warning") warnings++;
  }

  return { errors, warnings };
}
