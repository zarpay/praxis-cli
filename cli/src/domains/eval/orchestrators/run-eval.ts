import type {
  EvalProgress,
  EvalSummary,
  EvalUnit,
  RunEvalInput,
  RunEvalResult,
  TargetVerdict,
  ValidationDomain,
} from "@/domains/eval/types.js";
import type { JudgeConfig } from "@/types.js";

import { DEFAULT_SPEC_FILE_PATTERN } from "@/core/config.js";
import { errors } from "@/core/errors.js";
import { readText } from "@/core/files.js";
import { baseName, relativePath } from "@/core/paths.js";
import { Judge } from "@/domains/eval/models/judge.js";
import { JudgmentTarget } from "@/domains/eval/models/judgment-target.js";
import discoverDomains from "@/domains/eval/services/discover-domains.js";
import { cacheIdentity } from "@/domains/eval/services/judge-hash.js";
import { evaluateTarget } from "@/domains/eval/services/judge-target.js";
import listSourceDocuments from "@/domains/eval/services/list-source-documents.js";
import resolveUnits from "@/domains/eval/services/resolve-units.js";
import { CacheManager } from "@/domains/eval/services/verdict-cache.js";

/**
 * One `praxis eval run`: judge every target every judge covers.
 *
 * Discovers the specs, resolves them into units, and judges each unit
 * with each judge — **judge-major**, so one instrument's output stays
 * contiguous in the terminal rather than interleaving.
 *
 * Everything the caller needs comes back in the result; progress
 * arrives through `onProgress` as it happens, so the orchestrator never
 * touches an output stream. A judging failure is recorded as an error
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
  judges,
  useCache = true,
  failFast = false,
  type,
  onProgress,
}: RunEvalInput): Promise<RunEvalResult> {
  const scope = { root, sources, specFilePattern, absoluteIgnore };
  const domains = selectDomains(discoverDomains(scope), type);

  // Each judge gets its own cache bound to its identity: verdicts share
  // one file per target, keyed by (spec, judge) so they never collide.
  const caches = judges.map((judge) =>
    useCache ? new CacheManager({ projectRoot: root, judge: cacheIdentity(judge) }) : null,
  );

  const queue = domains.flatMap((domain) =>
    resolveUnits({ domain, specFilePattern, absoluteIgnore }).map((unit) => ({ unit, domain })),
  );

  const verdicts: TargetVerdict[] = [];
  const cacheStats = { hits: 0, misses: 0 };
  const total = queue.length * judges.length;
  let index = 0;
  let stoppedEarly = false;

  for (const [judgeIndex, judgeConfig] of judges.entries()) {
    for (const { unit, domain } of queue) {
      if (stoppedEarly) break;

      index++;
      onProgress?.({
        kind: "unit-start",
        index,
        total,
        path: unit.path,
        cohortSize: isCohort(unit) ? unit.files.length : undefined,
        judgeName: judges.length > 1 ? judgeConfig.name : undefined,
      });

      const verdict = await judgeOneUnit({
        unit,
        specPath: domain.specPath,
        type: domain.type,
        judgeConfig,
        cache: caches[judgeIndex] ?? null,
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

/** Whether a unit judges a set of files rather than the one at its path. */
export function isCohort(unit: EvalUnit): boolean {
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

/** Judges one unit with one judge, turning any failure into an error verdict. */
async function judgeOneUnit({
  unit,
  specPath,
  type,
  judgeConfig,
  cache,
  root,
  specFilePattern,
  cacheStats,
  onProgress,
}: {
  unit: EvalUnit;
  specPath: string;
  type: string;
  judgeConfig: JudgeConfig;
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
    judge: judgeConfig.name,
  };

  try {
    const cohort = isCohort(unit);
    const target = JudgmentTarget.resolve({
      targetPath: unit.path,
      targetContent: cohort ? assembleCohort(unit, root) : undefined,
      kind: cohort ? "cohort" : "file",
      specPath,
      specFilePattern,
      root,
    });

    const { verdict, cacheHit } = await evaluateTarget({
      target,
      judge: Judge.fromConfig(judgeConfig),
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
 * Assembles a cohort's members into one judgment input, each labeled
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
 * directories plus any file judged via spec `paths:` targeting, which
 * may live outside the sources and have any extension. `notValidated`
 * is the count of those no verdict covers — a document with no spec, or
 * a target fail-fast never reached.
 */
function summarize(verdicts: TargetVerdict[], sourceDocs: Set<string>): EvalSummary {
  const byType: EvalSummary["byType"] = {};
  const byJudge: EvalSummary["byJudge"] = {};

  for (const verdict of verdicts) {
    byType[verdict.type] ??= { total: 0, compliant: 0, issues: 0 };
    byType[verdict.type].total++;

    if (verdict.compliant) byType[verdict.type].compliant++;
    else byType[verdict.type].issues++;

    byJudge[verdict.judge] ??= { compliant: 0, warnings: 0, errors: 0 };

    if (verdict.compliant) byJudge[verdict.judge].compliant++;
    else if (verdict.severity === "warning") byJudge[verdict.judge].warnings++;
    else byJudge[verdict.judge].errors++;
  }

  const judgedPaths = new Set(verdicts.map((v) => v.path));
  const allDocs = new Set([...sourceDocs, ...judgedPaths]);

  return {
    total: allDocs.size,
    compliant: verdicts.filter((v) => v.compliant).length,
    warnings: verdicts.filter((v) => !v.compliant && v.severity === "warning").length,
    errors: verdicts.filter((v) => !v.compliant && v.severity === "error").length,
    notValidated: allDocs.size - judgedPaths.size,
    byType,
    byJudge,
  };
}
