import type {
  EvalSummary,
  EvalUnit,
  LedgerEntry,
  LedgerEvidence,
  ReviewAllInput,
  ReviewAllResult,
  ReviewUnitInput,
  Service,
  TargetVerdict,
  ValidationDomain,
} from "@/types.js";

import { errors } from "@/helpers/errors-helper.js";
import { readText } from "@/helpers/files-helper.js";
import { baseName, relativePath } from "@/helpers/paths-helper.js";
import { ReviewSubject } from "@/models/review-subject.js";
import { Reviewer } from "@/models/reviewer.js";
import discoverDomainsService from "@/services/discover-domains-service.js";
import resolveUnitsService from "@/services/resolve-units-service.js";
import reviewTargetService from "@/services/review-target-service.js";
import writeLedgerRunService from "@/services/write-ledger-run-service.js";
import { AxiomStore } from "@/stores/axiom-store.js";
import { DocumentStore } from "@/stores/document-store.js";
import { VerdictStore } from "@/stores/verdict-store.js";

/**
 * One `praxis eval run`: review every target every reviewer covers.
 *
 * Discovers the specs, resolves them into units, and reviews each unit
 * with each reviewer — **reviewer-major**, so one instrument's output stays
 * contiguous in the terminal rather than interleaving.
 *
 * Everything the caller needs comes back in the result; progress
 * arrives through `onProgress` as it happens, so the orchestrator never
 * touches an output stream. A unit that cannot be reviewed at all is
 * recorded as `unverified` rather than raised or counted as a violation
 * (03): one unreachable target must not abandon a run that costs real
 * money, and must never masquerade as a finding.
 *
 * Each reviewer's completed pass is persisted to the ledger (05) unless
 * `ledger: false` — one run record per reviewer, one critique per issue.
 *
 * @throws PraxisError only when `type` matches no discovered domain
 */
const reviewAllService: Service<ReviewAllInput, Promise<ReviewAllResult>> = async (
  cfg,
  { reviewers, useCache = true, failFast = false, ledger = true, type, onProgress },
) => {
  const root = cfg.root;
  const domains = selectDomains(discoverDomainsService(cfg, {}), type);

  // Each reviewer gets its own cache bound to its identity: verdicts share
  // one file per target, keyed by (spec, reviewer) so they never collide.
  const caches = reviewers.map((reviewer) =>
    useCache
      ? new VerdictStore(cfg, { reviewer: Reviewer.fromConfig(reviewer).cacheIdentity() })
      : null,
  );

  const queue = domains.flatMap((domain) =>
    resolveUnitsService(cfg, { domain }).map((unit) => ({ unit, domain })),
  );

  const specUnits: Record<string, number> = {};

  for (const { domain } of queue) {
    const spec = relativePath(root, domain.specPath);
    specUnits[spec] = (specUnits[spec] ?? 0) + 1;
  }

  const verdicts: TargetVerdict[] = [];
  const cacheStats = { hits: 0, misses: 0 };
  const total = queue.length * reviewers.length;

  let index = 0;
  let stoppedEarly = false;

  for (const [reviewerIndex, reviewerConfig] of reviewers.entries()) {
    const entries: LedgerEntry[] = [];

    for (const { unit, domain } of queue) {
      if (stoppedEarly) break;

      index++;
      onProgress?.({
        kind: "unit-start",
        index,
        total,
        path: unit.path,
        cohortSize: isCohort(unit) ? unit.files.length : undefined,
        reviewerName: reviewers.length > 1 ? reviewerConfig.name : undefined,
      });

      const { verdict, cacheHit, evidence } = await reviewUnit(cfg, {
        unit,
        specPath: domain.specPath,
        type: domain.type,
        reviewerConfig,
        cache: caches[reviewerIndex] ?? null,
        onProgress,
      });

      if (evidence) {
        if (cacheHit) cacheStats.hits++;
        else cacheStats.misses++;
      }

      verdicts.push(verdict);
      entries.push({ verdict, cacheHit, evidence });

      if (failFast && !verdict.compliant && !verdict.unverified && verdict.severity === "error") {
        stoppedEarly = true;
      }
    }

    if (ledger && entries.length > 0) {
      writeLedgerRunService(cfg, {
        reviewer: Reviewer.fromConfig(reviewerConfig).cacheIdentity(),
        trigger: "manual",
        scope: "corpus",
        entries,
        specUnits,
      });
    }
  }

  const documentStore = new DocumentStore(cfg);
  const sourceDocs = new Set(documentStore.files());

  return {
    verdicts,
    cacheStats,
    stoppedEarly,
    summary: summarize(verdicts, sourceDocs),
  };
};

export default reviewAllService;

/** Whether a unit reviews a set of files rather than the one at its path. */
function isCohort(unit: EvalUnit): boolean {
  return unit.files.length > 1 || unit.files[0] !== unit.path;
}

/**
 * The domains a run covers.
 *
 * @throws PraxisError when a type is given that no domain matches
 */
function selectDomains(domains: ValidationDomain[], type?: string): ValidationDomain[] {
  if (!type) return domains;

  const matching = domains.filter((d) => d.type === type || baseName(d.dir) === type);

  if (matching.length === 0) {
    const available = [...new Set(domains.map((domain) => domain.type))];

    throw errors.unknownDocumentType(type, available);
  }

  return matching;
}

/**
 * Reviews one unit with one reviewer, turning any failure into an error
 * verdict — one unreachable target must not abandon a run that costs
 * real money. Returns what happened and whether the cache answered, and
 * mutates nothing: the caller keeps its own tallies.
 */
const reviewUnit: Service<
  ReviewUnitInput,
  Promise<{
    verdict: TargetVerdict;
    cacheHit: boolean;
    evidence: LedgerEvidence | null;
  }>
> = async (cfg, { unit, specPath, type, reviewerConfig, cache, onProgress }) => {
  const root = cfg.root;
  const identity = {
    path: unit.path,
    type,
    filename: baseName(unit.path),
    reviewer: reviewerConfig.name,
  };

  try {
    const cohort = isCohort(unit);
    const target = ReviewSubject.resolve({
      targetPath: unit.path,
      targetContent: cohort ? assembleCohort(unit, root) : undefined,
      kind: cohort ? "cohort" : "file",
      specPath,
      root,
      checklistFor: (spec) => new AxiomStore(cfg).checklistFor(spec),
    });

    const { verdict, cacheHit, usage } = await reviewTargetService(cfg, {
      target,
      reviewer: Reviewer.fromConfig(reviewerConfig),
      cache,
    });

    onProgress?.({ kind: "verdict", verdict });

    return {
      verdict: { ...verdict, ...identity },
      cacheHit,
      evidence: {
        usage,
        specPath: target.specPath,
        targetContentHash: target.targetContentHash(),
        specContentHash: target.specContentHash(),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    onProgress?.({ kind: "unit-error", message });

    // Nothing was reviewed: no violation, no cache, no ledger critiques.
    return {
      cacheHit: false,
      evidence: null,
      verdict: {
        ...identity,
        compliant: false,
        unverified: true,
        issues: [],
        reason: message,
      },
    };
  }
};

/**
 * Assembles a cohort's members into one review input, each labeled
 * with its project-relative path so critiques can locate their file.
 */
function assembleCohort(unit: EvalUnit, root: string): string {
  return unit.files
    .map((file) => `===== FILE: ${relativePath(root, file)} =====\n\n${readText(file)}`)
    .join("\n\n");
}

/**
 * Aggregates a run's verdicts.
 *
 * `total` covers every document seen: all .md documents in the source
 * directories plus any file reviewed via spec `paths:` targeting, which
 * may live outside the sources and have any extension. `notValidated`
 * is the count of those no verdict covers — a document with no spec, or
 * a target fail-fast never reached.
 */
function summarize(verdicts: TargetVerdict[], sourceDocs: Set<string>): EvalSummary {
  const byType: EvalSummary["byType"] = {};
  const byReviewer: EvalSummary["byReviewer"] = {};

  for (const verdict of verdicts) {
    byType[verdict.type] ??= { total: 0, compliant: 0, issues: 0 };
    byType[verdict.type].total++;

    if (verdict.compliant) byType[verdict.type].compliant++;
    else byType[verdict.type].issues++;

    byReviewer[verdict.reviewer] ??= { compliant: 0, warnings: 0, errors: 0 };

    if (verdict.unverified) continue;

    if (verdict.compliant) byReviewer[verdict.reviewer].compliant++;
    else if (verdict.severity === "warning") byReviewer[verdict.reviewer].warnings++;
    else byReviewer[verdict.reviewer].errors++;
  }

  const reviewedPaths = new Set(verdicts.map((v) => v.path));
  const allDocs = new Set([...sourceDocs, ...reviewedPaths]);

  const reviewed = verdicts.filter((v) => !v.unverified);

  return {
    total: allDocs.size,
    compliant: reviewed.filter((v) => v.compliant).length,
    warnings: reviewed.filter((v) => !v.compliant && v.severity === "warning").length,
    errors: reviewed.filter((v) => !v.compliant && v.severity === "error").length,
    unverified: verdicts.filter((v) => v.unverified).length,
    notValidated: allDocs.size - reviewedPaths.size,
    byType,
    byReviewer,
  };
}
