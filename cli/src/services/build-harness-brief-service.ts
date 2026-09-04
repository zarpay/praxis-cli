import type { PraxisConfig } from "@/models/praxis-config.js";
import type {
  DebtRow,
  FlowRow,
  HarnessBrief,
  HarnessBriefAxiom,
  HarnessDiagnosis,
  LedgerCalibrationRecord,
  PopulationQualifier,
  ScopedLedger,
  Service,
} from "@/types.js";

import buildDebtReportService from "@/services/build-debt-report-service.js";
import buildEvalReportService from "@/services/build-eval-report-service.js";
import { AxiomStore } from "@/stores/axiom-store.js";
import { CalibrationStore } from "@/stores/calibration-store.js";

/** What the brief derives over. */
interface BuildHarnessBriefInput {
  scoped: ScopedLedger;
}

/** How many axioms a brief surfaces — depth belongs to the drill-downs. */
const TOP_AXIOMS = 5;

/**
 * The harness brief (08): evidence about which harness elements to
 * change, assembled entirely from the ledger and the metrics reads —
 * pure read, no model call, on demand and never per-run (08-m).
 *
 * Every diagnosis is *suggested*, never verdicted (02-n): the decision
 * rules triangulate without a control arm, so each entry states its
 * reasoning and the human makes the call. The expectation stated in 08
 * holds here by construction: the rules point at the spec and the
 * reviewer as readily as at the harness.
 */
const buildHarnessBriefService: Service<BuildHarnessBriefInput, HarnessBrief> = (
  cfg,
  { scoped },
) => {
  const evalReport = buildEvalReportService(cfg, { scoped });
  const debtReport = buildDebtReportService(cfg, {});
  const calibrationStore = new CalibrationStore(cfg);

  const flowRows = evalReport.flow?.rows ?? [];
  const debtByKey = new Map(
    debtReport.rows.map((row) => [`${row.axiomId} ${row.reviewerName}`, row]),
  );

  const entries = flowRows.map((row) => {
    const debtRow = debtByKey.get(`${row.axiomId} ${row.reviewerName}`) ?? null;
    const calibration = calibrationStore.latestByName(row.reviewerName);

    return briefAxiom(row, debtRow, calibration, scoped);
  });

  const ranked = entries.sort((a, b) => weightOf(b) - weightOf(a)).slice(0, TOP_AXIOMS);

  const timestamps = scoped.runs.map((run) => run.timestamp).sort();

  return {
    period: { from: timestamps[0] ?? null, to: timestamps.at(-1) ?? null },
    populations: populationTotals(flowRows),
    calibration: evalReport.calibration,
    top_axioms: ranked,
    residual_summary: `dismissed + rejected over critiques: ${evalReport.residual.display}`,
    removal_candidates: removalCandidates(cfg, scoped),
    note:
      "Diagnoses are suggested, never verdicted (02). Briefs never auto-apply; " +
      "spec_problem routes to the spec owner, reviewer_noise to calibration. " +
      "A change that would soften a spec must carry the coverage/conformance pairing (07 rule 1).",
  };
};

export default buildHarnessBriefService;

/** An entry's rank: what fires in generation first, then standing debt. */
function weightOf(entry: HarnessBriefAxiom): number {
  return entry.introduction_rate.numerator * 10 + entry.debt_stock;
}

/** One (axiom, reviewer) entry with its suggested diagnosis. */
function briefAxiom(
  row: FlowRow,
  debtRow: DebtRow | null,
  calibration: LedgerCalibrationRecord | null,
  scoped: ScopedLedger,
): HarnessBriefAxiom {
  const debtStock = debtRow?.currentStock ?? 0;
  const paydown = debtRow?.paydown ?? 0;
  const { diagnosis, reason } = diagnose(row, debtStock, calibration);

  const examples = scoped.critiques
    .filter((critique) => critique.axiom_id === row.axiomId && critique.flow !== "resolved")
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 5)
    .map((critique) => ({ id: critique.id, text: critique.text }));

  return {
    axiom_id: row.axiomId,
    statement: row.statement,
    reviewer: row.reviewerName,
    epoch: epochOf(scoped, row.reviewerName),
    introduction_rate: row.introductionRate,
    debt_stock: debtStock,
    paydown,
    trend: `introduced ${row.introduced} · resolved ${row.resolved} · inherited ${row.inherited} over the selected diffs`,
    representative_critiques: examples,
    suggested_diagnosis: diagnosis,
    diagnosis_reason: reason,
  };
}

/**
 * 02's decision rules, in decreasing confidence, each showing its work.
 * Heuristic by design: the triangulation has no control arm, so the
 * brief suggests and the human decides.
 */
function diagnose(
  row: FlowRow,
  debtStock: number,
  calibration: LedgerCalibrationRecord | null,
): { diagnosis: HarnessDiagnosis; reason: string } {
  const score = calibration?.axiom_scores.find((candidate) => candidate.axiom_id === row.axiomId);

  if (row.introductionRate.rate === null) {
    return {
      diagnosis: "insufficient_data",
      reason: `introduction rate: ${row.introductionRate.display} — recommend nothing below the floor (02)`,
    };
  }

  if (score && (score.false_positives > 0 || (score.variance ?? 0) > 0)) {
    return {
      diagnosis: "reviewer_noise",
      reason:
        `calibration measured ${score.false_positives} false positive(s)` +
        (score.variance ? ` and variance ${score.variance.toFixed(2)}` : "") +
        " on this axiom — route to calibration (06)",
    };
  }

  if (debtStock > 0 && row.introductionRate.rate >= 0.5) {
    return {
      diagnosis: "spec_problem",
      reason:
        `high debt density (stock ${debtStock}) and a high introduction rate ` +
        `(${row.introductionRate.display}) — both eras violate it, so the standard may be unanswerable; route to the spec owner`,
    };
  }

  if (row.resolved > 0) {
    return {
      diagnosis: "harness_gap",
      reason:
        "violations get fixed when pointed at (resolution flow exists) yet keep being introduced — " +
        "the standard is followable but the harness does not carry it into generation",
    };
  }

  return {
    diagnosis: "harness_gap",
    reason:
      "post-spec introductions with no countervailing signal — the brief's default suspect, weakly held",
  };
}

/** Introduced counts by population across the selected diff runs. */
function populationTotals(rows: FlowRow[]): Record<PopulationQualifier, number> {
  const totals: Record<PopulationQualifier, number> = { pre_spec: 0, post_spec: 0, unknown: 0 };

  for (const row of rows) {
    totals.pre_spec += row.introducedByPopulation.pre_spec;
    totals.post_spec += row.introducedByPopulation.post_spec;
    totals.unknown += row.introducedByPopulation.unknown;
  }

  return totals;
}

/** Active axioms nothing in scope evidences — audit candidates, not verdicts. */
function removalCandidates(cfg: PraxisConfig, scoped: ScopedLedger): string[] {
  const evidenced = new Set(
    scoped.critiques
      .map((critique) => critique.axiom_id)
      .filter((axiomId): axiomId is string => axiomId !== null),
  );

  return new AxiomStore(cfg)
    .all()
    .axioms.filter((axiom) => axiom.status === "active" && !evidenced.has(axiom.id))
    .map((axiom) => axiom.id)
    .sort();
}

/** The reviewer's current behavioral hash from the scoped runs. */
function epochOf(scoped: ScopedLedger, reviewerName: string): string {
  const runs = scoped.runs
    .filter((run) => run.reviewer_name === reviewerName)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return runs.at(-1)?.reviewer_hash ?? "unknown";
}
