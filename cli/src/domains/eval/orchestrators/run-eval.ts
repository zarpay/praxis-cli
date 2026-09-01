import type {
  EvalProgress,
  EvalSummary,
  EvalUnit,
  RunEvalInput,
  RunEvalResult,
  TargetVerdict,
  ValidationDomain,
} from "@/domains/eval/types.js";
import type { ReviewerConfig } from "@/types.js";

import { errors } from "@/core/errors.js";
import { readText } from "@/core/files.js";
import { baseName, relativePath } from "@/core/paths.js";
import { ReviewSubject } from "@/domains/eval/models/review-subject.js";
import { Reviewer } from "@/domains/eval/models/reviewer.js";
import cacheIdentity from "@/domains/eval/services/build-cache-identity.js";
import discoverDomains from "@/domains/eval/services/discover-domains.js";
import listSourceDocuments from "@/domains/eval/services/list-source-documents.js";
import resolveUnits from "@/domains/eval/services/resolve-units.js";
import reviewTarget from "@/domains/eval/services/review-target.js";
import { CacheManager } from "@/domains/eval/services/verdict-cache.js";
import { DEFAULT_SPEC_FILE_PATTERN } from "@/domains/workspace/models/praxis-config.js";

/**
 * One `praxis eval run`: reviewer every target every reviewer covers.
 *
 * Discovers the specs, resolves them into units, and reviews each unit
 * with each reviewer — **reviewer-major**, so one instrument's output stays
 * contiguous in the terminal rather than interleaving.
 *
 * Everything the caller needs comes back in the result; progress
 * arrives through `onProgress` as it happens, so the orchestrator never
 * touches an output stream. A reviewing failure is recorded as an error
 * verdict rather than raised: one unreachable target must not abandon
 * the rest of a run that costs real money.
 *
 * @throws PraxisError only when `type` matches no discovered domain
 */
export default async function runEval({
  root,
  sources,
  specFilePattern = DEFAULT_SPEC_FILE_PATTERN,
  absoluteIgnore = [],
  reviewers,
  useCache = true,
  failFast = false,
  type,
  onProgress,
}: RunEvalInput): Promise<RunEvalResult> {
  const scope = { root, sources, specFilePattern, absoluteIgnore };
  const domains = selectDomains(discoverDomains(scope), type);

  // Each reviewer gets its own cache bound to its identity: verdicts share
  // one file per target, keyed by (spec, reviewer) so they never collide.
  const caches = reviewers.map((reviewer) =>
    useCache ? new CacheManager({ projectRoot: root, reviewer: cacheIdentity(reviewer) }) : null,
  );

  const queue = domains.flatMap((domain) =>
    resolveUnits({ domain, specFilePattern, absoluteIgnore }).map((unit) => ({ unit, domain })),
  );

  const verdicts: TargetVerdict[] = [];
  const cacheStats = { hits: 0, misses: 0 };
  const total = queue.length * reviewers.length;
  let index = 0;
  let stoppedEarly = false;

  for (const [reviewerIndex, reviewerConfig] of reviewers.entries()) {
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

      const verdict = await reviewUnit({
        unit,
        specPath: domain.specPath,
        type: domain.type,
        reviewerConfig,
        cache: caches[reviewerIndex] ?? null,
        root,
        specFilePattern,
        cacheStats,
        onProgress,
      });

      verdicts.push(verdict);

      if (failFast && !verdict.compliant && verdict.severity === "error") {
        stoppedEarly = true;
      }
    }
  }

  return {
    verdicts,
    cacheStats,
    stoppedEarly,
    summary: summarize(verdicts, listSourceDocuments(scope)),
  };
}

/** Whether a unit reviewers a set of files rather than the one at its path. */
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
    throw errors.unknownDocumentType(type);
  }

  return matching;
}

/** Reviewers one unit with one reviewer, turning any failure into an error verdict. */
async function reviewUnit({
  unit,
  specPath,
  type,
  reviewerConfig,
  cache,
  root,
  specFilePattern,
  cacheStats,
  onProgress,
}: {
  unit: EvalUnit;
  specPath: string;
  type: string;
  reviewerConfig: ReviewerConfig;
  cache: CacheManager | null;
  root: string;
  specFilePattern: string;
  cacheStats: { hits: number; misses: number };
  onProgress?: (event: EvalProgress) => void;
}): Promise<TargetVerdict> {
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
      specFilePattern,
      root,
    });

    const { verdict, cacheHit } = await reviewTarget({
      target,
      reviewer: Reviewer.fromConfig(reviewerConfig),
      cache,
      root,
    });

    if (cacheHit) cacheStats.hits++;
    else cacheStats.misses++;

    onProgress?.({ kind: "verdict", verdict });

    return { ...verdict, ...identity };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    onProgress?.({ kind: "unit-error", message });

    return {
      ...identity,
      compliant: false,
      severity: "error",
      issues: [`Validation failed: ${message}`],
      reason: message,
    };
  }
}

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

    if (verdict.compliant) byReviewer[verdict.reviewer].compliant++;
    else if (verdict.severity === "warning") byReviewer[verdict.reviewer].warnings++;
    else byReviewer[verdict.reviewer].errors++;
  }

  const reviewedPaths = new Set(verdicts.map((v) => v.path));
  const allDocs = new Set([...sourceDocs, ...reviewedPaths]);

  return {
    total: allDocs.size,
    compliant: verdicts.filter((v) => v.compliant).length,
    warnings: verdicts.filter((v) => !v.compliant && v.severity === "warning").length,
    errors: verdicts.filter((v) => !v.compliant && v.severity === "error").length,
    notValidated: allDocs.size - reviewedPaths.size,
    byType,
    byReviewer,
  };
}
