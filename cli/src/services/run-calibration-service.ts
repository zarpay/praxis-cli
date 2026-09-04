import type { CalibrationCase } from "@/models/calibration-case.js";
import type { PraxisConfig } from "@/models/praxis-config.js";
import type { Reviewer } from "@/models/reviewer.js";
import type {
  CalibrationAxiomScore,
  CalibrationCaseOutcome,
  CalibrationVerdict,
  LedgerCalibrationRecord,
  ProviderUsage,
  Service,
  Verdict,
} from "@/types.js";

import { gitFacts } from "@/helpers/git-helper.js";
import { joinPath } from "@/helpers/paths-helper.js";
import { ReviewSubject } from "@/models/review-subject.js";
import deriveChecklistHashService from "@/services/derive-checklist-hash-service.js";
import reviewTargetService from "@/services/review-target-service.js";
import { AxiomStore } from "@/stores/axiom-store.js";
import { CalibrationCaseStore } from "@/stores/calibration-case-store.js";
import { CalibrationStore } from "@/stores/calibration-store.js";

/** One reviewer's calibration run over the frozen case set. */
interface RunCalibrationInput {
  reviewer: Reviewer;
  cases: CalibrationCase[];
  /** Full-set passes; > 1 measures variance (06's nondeterminism probe). */
  repeats: number;
  onProgress?: (event: CalibrationProgress) => void;
}

/** Progress event for the orchestrator's streaming render. */
interface CalibrationProgress {
  kind: "case";
  outcome: CalibrationCaseOutcome;
}

/** The written record, where it landed, and the per-case detail. */
interface RunCalibrationResult {
  record: LedgerCalibrationRecord;
  path: string;
  outcomes: CalibrationCaseOutcome[];
}

/**
 * The drift threshold (06, default decided 2026-09-05): an axiom whose
 * accuracy moved more than this against the previous record — across
 * identities, because drift is exactly what a behavioral change is
 * measured for — is flagged as no longer comparable.
 */
const DRIFT_THRESHOLD = 0.1;

/**
 * Measures one reviewer against the frozen case set (06): every case
 * reviewed `repeats` times, scored against its adjudication, assembled
 * into a calibration record and written to the ledger's calibration
 * partition.
 *
 * Calibration never touches the verdict cache (decided 2026-09-05): a
 * cached verdict would measure the cache, and repeats exist to measure
 * the instrument's variance, which a cache hit hides by construction.
 * A failed review is an unverified outcome — counted as disagreement,
 * never dropped.
 */
const runCalibrationService: Service<RunCalibrationInput, Promise<RunCalibrationResult>> = async (
  cfg,
  { reviewer, cases, repeats, onProgress },
) => {
  const outcomes: CalibrationCaseOutcome[] = [];
  const verdicts: (Verdict | null)[][] = [];
  const usages: (ProviderUsage | null)[] = [];

  for (let repeat = 1; repeat <= repeats; repeat++) {
    const pass: (Verdict | null)[] = [];

    for (const currentCase of cases) {
      const reviewed = await reviewCase(cfg, currentCase, reviewer);
      const outcome = outcomeOf(currentCase, repeat, reviewed.verdict);

      pass.push(reviewed.verdict);
      usages.push(reviewed.usage);
      outcomes.push(outcome);
      onProgress?.({ kind: "case", outcome });
    }

    verdicts.push(pass);
  }

  const store = new CalibrationStore(cfg);
  const record = assembleRecord(cfg, {
    reviewer,
    cases,
    repeats,
    verdicts,
    outcomes,
    usages,
    store,
  });
  const written = store.writeRecord(record);

  return { record, path: written.path, outcomes };
};

export default runCalibrationService;

/** One case reviewed once, cache bypassed; null verdict when unverified. */
async function reviewCase(
  cfg: PraxisConfig,
  currentCase: CalibrationCase,
  reviewer: Reviewer,
): Promise<{ verdict: Verdict | null; usage: ProviderUsage | null }> {
  const liveSpecPath = joinPath(cfg.root, currentCase.expectation.spec_path);

  try {
    const target = ReviewSubject.resolve({
      targetPath: currentCase.inputPath,
      specPath: currentCase.specPath,
      root: cfg.root,
      checklistFor: () => new AxiomStore(cfg).checklistFor(liveSpecPath),
    });

    const reviewed = await reviewTargetService(cfg, { target, reviewer, cache: null });

    return { verdict: reviewed.verdict, usage: reviewed.usage };
  } catch {
    return { verdict: null, usage: null };
  }
}

/** A verdict folded to the case vocabulary. */
function verdictCategory(verdict: Verdict): CalibrationVerdict {
  if (verdict.compliant) return "pass";

  return verdict.severity === "error" ? "fail" : "warn";
}

/** One case × repeat outcome against its adjudication. */
function outcomeOf(
  currentCase: CalibrationCase,
  repeat: number,
  verdict: Verdict | null,
): CalibrationCaseOutcome {
  const expected = currentCase.expectation.verdict;
  const actual = verdict ? verdictCategory(verdict) : null;

  return { caseId: currentCase.id, repeat, expected, actual, matched: actual === expected };
}

/** Everything record assembly reads. */
interface AssembleRecordInput {
  reviewer: Reviewer;
  cases: CalibrationCase[];
  repeats: number;
  /** Per repeat, per case (parallel to `cases`); null = unverified. */
  verdicts: (Verdict | null)[][];
  outcomes: CalibrationCaseOutcome[];
  usages: (ProviderUsage | null)[];
  store: CalibrationStore;
}

/** The run's record: scores, provenance, drift against the previous record. */
function assembleRecord(cfg: PraxisConfig, input: AssembleRecordInput): LedgerCalibrationRecord {
  const { reviewer, cases, repeats, verdicts, outcomes, usages, store } = input;
  const facts = gitFacts(cfg.root);
  const axiomScores = scoreAxioms(cases, verdicts, repeats);
  const previous = store.latestByName(reviewer.name);

  return {
    kind: "calibration",
    calibration_id: store.mintCalibrationId(),
    timestamp: new Date().toISOString(),
    commit_sha: facts.commitSha,
    branch: facts.branch,
    reviewer_name: reviewer.name,
    reviewer_model: reviewer.model,
    reviewer_hash: reviewer.hash(),
    case_count: cases.length,
    case_set_hash: new CalibrationCaseStore(cfg).caseSetHash(),
    checklist_hash: deriveChecklistHashService(cfg, { cases }),
    repeats,
    verdict_matches: outcomes.filter((outcome) => outcome.matched).length,
    unverified_count: outcomes.filter((outcome) => outcome.actual === null).length,
    false_positive_count: axiomScores.reduce((sum, score) => sum + score.false_positives, 0),
    axiom_scores: axiomScores,
    drift_flagged: previous ? driftFlagged(axiomScores, previous.axiom_scores) : [],
    prompt_tokens: sumOf(usages, "promptTokens"),
    completion_tokens: sumOf(usages, "completionTokens"),
    cost_usd: sumOf(usages, "costUsd"),
  };
}

/** A usage field summed across calls; null when no call reported it. */
function sumOf(
  usages: (ProviderUsage | null)[],
  field: "promptTokens" | "completionTokens" | "costUsd",
): number | null {
  const reported = usages
    .map((usage) => usage?.[field])
    .filter((value): value is number => typeof value === "number");

  if (reported.length === 0) return null;

  return reported.reduce((sum, value) => sum + value, 0);
}

/** Per-axiom TP/FP/FN counts across cases × repeats, plus repeat variance. */
function scoreAxioms(
  cases: CalibrationCase[],
  verdicts: (Verdict | null)[][],
  repeats: number,
): CalibrationAxiomScore[] {
  const axiomIds = [...new Set(cases.flatMap((currentCase) => currentCase.axiomIds()))].sort();

  return axiomIds.map((axiomId) => scoreAxiom(axiomId, cases, verdicts, repeats));
}

/** One axiom's counts: expected flags hit, forbidden flags fired. */
function scoreAxiom(
  axiomId: string,
  cases: CalibrationCase[],
  verdicts: (Verdict | null)[][],
  repeats: number,
): CalibrationAxiomScore {
  let opportunities = 0;
  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  const flagsPerRepeat: number[] = [];

  for (let repeat = 0; repeat < repeats; repeat++) {
    let flags = 0;

    for (const [index, currentCase] of cases.entries()) {
      const verdict = verdicts[repeat][index];
      const flagged = verdict?.issues.some((issue) => issue.axiomId === axiomId) ?? false;
      const expectsFlag = currentCase.expectation.expected_violations.some(
        (entry) => entry.axiom_id === axiomId,
      );
      const forbidsFlag = currentCase.expectation.forbidden_violations.some(
        (entry) => entry.axiom_id === axiomId,
      );

      if (flagged) flags++;

      if (expectsFlag) {
        opportunities++;

        if (flagged) truePositives++;
        else falseNegatives++;
      }

      if (forbidsFlag) {
        opportunities++;

        if (flagged) falsePositives++;
      }
    }

    flagsPerRepeat.push(flags);
  }

  return {
    axiom_id: axiomId,
    cases: opportunities,
    true_positives: truePositives,
    false_positives: falsePositives,
    false_negatives: falseNegatives,
    variance: repeats > 1 ? variance(flagsPerRepeat) : null,
  };
}

/** Population variance of the per-repeat flag counts. */
function variance(counts: number[]): number {
  const mean = counts.reduce((sum, count) => sum + count, 0) / counts.length;
  const squared = counts.map((count) => (count - mean) ** 2);

  return squared.reduce((sum, value) => sum + value, 0) / counts.length;
}

/** An axiom's agreement rate from its stored counts. */
function accuracyOf(score: CalibrationAxiomScore): number | null {
  if (score.cases === 0) return null;

  const forbiddenHeld = score.cases - score.true_positives - score.false_negatives;
  const correct = score.true_positives + (forbiddenHeld - score.false_positives);

  return correct / score.cases;
}

/** Axioms whose accuracy moved beyond the threshold, present in both records. */
function driftFlagged(
  current: CalibrationAxiomScore[],
  previous: CalibrationAxiomScore[],
): string[] {
  const previousById = new Map(previous.map((score) => [score.axiom_id, score]));

  return current
    .filter((score) => {
      const before = previousById.get(score.axiom_id);

      if (!before) return false;

      const nowAccuracy = accuracyOf(score);
      const thenAccuracy = accuracyOf(before);

      if (nowAccuracy === null || thenAccuracy === null) return false;

      return Math.abs(nowAccuracy - thenAccuracy) > DRIFT_THRESHOLD;
    })
    .map((score) => score.axiom_id);
}
