import type {
  GovernedUnit,
  LedgerEntry,
  LedgerScope,
  ProviderUsage,
  ReviewedTarget,
  Service,
  Verdict,
} from "@/types.js";

import { relativePath } from "@/helpers/paths-helper.js";
import { ReviewSubject } from "@/models/review-subject.js";
import { Reviewer } from "@/models/reviewer.js";
import assembleCohortService from "@/services/assemble-cohort-service.js";
import buildReviewedTargetService from "@/services/build-reviewed-target-service.js";
import reviewTargetService from "@/services/review-target-service.js";
import selectReviewersService from "@/services/select-reviewers-service.js";
import totalUsageService from "@/services/total-usage-service.js";
import writeLedgerRunService from "@/services/write-ledger-run-service.js";
import { VerdictStore } from "@/stores/verdict-store.js";

/** The units to review, and how the run is recorded. */
interface ReviewUnitsInput {
  units: GovernedUnit[];
  /** Narrow to one configured reviewer by name. */
  reviewer?: string;
  /** Whether to consult the verdict cache. */
  useCache?: boolean;
  /**
   * Whether a cache miss writes its verdict back.
   *
   * Advisory runs read but never write: a cached verdict is what a
   * later measurement run would hit, and a cache hit writes no critique
   * record — so an advisory run that populated the cache would silently
   * suppress the evidence the real run was supposed to produce.
   */
  writeCache?: boolean;
  /** The scope stamped on the ledger run record. */
  scope: LedgerScope;
  /** Called once per unit with its deduplicated findings. */
  onUnit?: (event: ReviewedTarget) => void;
}

/** What the run produced. */
interface ReviewUnitsResult {
  errors: number;
  warnings: number;
  /** Provider spend across the run; null when nothing was called. */
  usage: ProviderUsage | null;
}

/**
 * Reviews already-resolved units and records the run.
 *
 * Where `review-named` takes paths and finds a spec for each, this
 * takes units the specs themselves defined — so a cohort arrives as one
 * unit holding its members, and is reviewed as the single thing its
 * spec judges.
 */
const reviewUnitsService: Service<ReviewUnitsInput, Promise<ReviewUnitsResult>> = async (
  cfg,
  { units, reviewer: only, useCache = true, writeCache = true, scope, onUnit },
) => {
  const root = cfg.root;
  const reviewers = selectReviewersService(cfg, { only });
  const entriesByReviewer = new Map<string, LedgerEntry[]>();
  const specUnits: Record<string, number> = {};

  let errors = 0;
  let warnings = 0;

  for (const { unit, domain } of units) {
    const cohort = unit.files.length > 1 || unit.files[0] !== unit.path;
    const subject = ReviewSubject.resolve({
      targetPath: unit.path,
      targetContent: cohort ? assembleCohortService(cfg, { unit }) : undefined,
      kind: cohort ? "cohort" : "file",
      specPath: domain.specPath,
      root,
    });

    const specKey = relativePath(root, domain.specPath);
    specUnits[specKey] = (specUnits[specKey] ?? 0) + 1;

    const verdicts: { reviewerName: string; verdict: Verdict }[] = [];

    for (const reviewerConfig of reviewers) {
      const identity = Reviewer.fromConfig(reviewerConfig);
      const cache = useCache
        ? new VerdictStore(cfg, { reviewer: identity.cacheIdentity(), readOnly: !writeCache })
        : null;

      const { verdict, cacheHit, usage } = await reviewTargetService(cfg, {
        target: subject,
        reviewer: identity,
        cache,
      });

      verdicts.push({ reviewerName: reviewerConfig.name, verdict });

      const entries = entriesByReviewer.get(reviewerConfig.name) ?? [];
      entries.push({
        verdict: { ...verdict, path: unit.path },
        cacheHit,
        evidence: {
          usage,
          specPath: subject.specPath,
          targetContentHash: subject.targetContentHash(),
          specContentHash: subject.specContentHash(),
        },
      });
      entriesByReviewer.set(reviewerConfig.name, entries);
    }

    const reviewed = buildReviewedTargetService(cfg, {
      path: relativePath(root, unit.path),
      verdicts,
    });

    if (reviewed && !reviewed.verdict.compliant) {
      if (reviewed.verdict.severity === "error") errors++;
      else warnings++;
    }

    if (reviewed) onUnit?.(reviewed);
  }

  for (const reviewerConfig of reviewers) {
    const entries = entriesByReviewer.get(reviewerConfig.name);

    if (!entries || entries.length === 0) continue;

    writeLedgerRunService(cfg, {
      reviewer: Reviewer.fromConfig(reviewerConfig).cacheIdentity(),
      trigger: "manual",
      scope,
      entries,
      specUnits,
    });
  }

  const everyEntry = [...entriesByReviewer.values()].flat();
  const usages = everyEntry.map((entry) => entry.evidence?.usage ?? null);

  return { errors, warnings, usage: totalUsageService(cfg, { usages }) };
};

export default reviewUnitsService;
