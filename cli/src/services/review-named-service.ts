import type { LedgerEntry, ReviewNamedInput, ReviewNamedResult, Verdict } from "@/types.js";

import { ReviewSubject } from "@/models/review-subject.js";
import { Reviewer } from "@/models/reviewer.js";
import { VerdictCache } from "@/models/verdict-cache.js";
import reviewTarget from "@/services/review-target-service.js";
import selectReviewers from "@/services/select-reviewers-service.js";
import writeLedgerRun from "@/services/write-ledger-run-service.js";

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
 * Every fast-loop run is evidence (08): each reviewer's pass persists to
 * the ledger with `scope: "files"` unless `ledger: false`.
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
  ledger = true,
  onVerdict,
}: ReviewNamedInput): Promise<ReviewNamedResult> {
  const reviewers = selectReviewers({ configured: config.reviewers, only });
  const specPath = targets.length === 1 ? spec : undefined;
  const entriesByReviewer = new Map<string, LedgerEntry[]>();

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
      const { verdict, cacheHit, usage } = await reviewTarget({
        target: subject,
        reviewer: Reviewer.fromConfig(reviewerConfig),
        cache: useCache
          ? new VerdictCache({
              projectRoot: root,
              reviewer: Reviewer.fromConfig(reviewerConfig).cacheIdentity(),
            })
          : null,
        root,
      });

      verdicts.push(verdict);

      const entries = entriesByReviewer.get(reviewerConfig.name) ?? [];
      entries.push({
        verdict: { ...verdict, path: targetPath },
        cacheHit,
        evidence: {
          usage,
          specPath: subject.specPath,
          targetContentHash: subject.targetContentHash(),
          specContentHash: subject.specContentHash(),
        },
      });
      entriesByReviewer.set(reviewerConfig.name, entries);
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

  if (ledger) {
    for (const reviewerConfig of reviewers) {
      const entries = entriesByReviewer.get(reviewerConfig.name);

      if (!entries || entries.length === 0) continue;

      writeLedgerRun({
        root,
        reviewer: Reviewer.fromConfig(reviewerConfig).cacheIdentity(),
        trigger: "manual",
        scope: "files",
        entries,
      });
    }
  }

  return { errors, warnings };
}

/**
 * The worst of a target's verdicts, or null when there are none.
 *
 * Reviewers are separate instruments and may disagree, so a target's
 * outcome is the most serious thing any of them said rather than a
 * consensus: any error outranks any warning, which outranks a pass.
 */
function worstVerdict(verdicts: Verdict[]): Verdict | null {
  return verdicts.reduce<Verdict | null>(
    (worst, verdict) => (!worst || severityRank(verdict) > severityRank(worst) ? verdict : worst),
    null,
  );
}

/**
 * Orders one verdict: pass < warning < error.
 *
 * A compliant verdict is lowest regardless of what severity it carries,
 * because severity only describes a failure.
 */
function severityRank(verdict: Verdict): number {
  if (verdict.compliant) return 0;

  return verdict.severity === "warning" ? 1 : 2;
}
