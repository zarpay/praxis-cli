import type { AxiomFile } from "@/models/axiom-file.js";
import type { PraxisConfig } from "@/models/praxis-config.js";
import type {
  AxiomReportRow,
  BuildEvalReportInput,
  EpochSeries,
  EvalReport,
  LedgerCritiqueRecord,
  LedgerRunRecord,
  PopulationQualifier,
  Service,
} from "@/types.js";

import { CALIBRATION_STATUS, rateCell } from "@/helpers/metrics-helper.js";
import countSpecUnitsService from "@/services/count-spec-units-service.js";
import deriveEpochsService from "@/services/derive-epochs-service.js";
import derivePopulationService from "@/services/derive-population-service.js";
import deriveTriageStateService from "@/services/derive-triage-state-service.js";
import { AxiomStore } from "@/stores/axiom-store.js";

/**
 * The eval report (07): one structured payload the view renders and
 * `--json` emits verbatim — the build/display split that makes the
 * machine contract free.
 *
 * The hard rules are enforced here, not styled later: every rate is a
 * floor-aware cell with its denominator (rule 3); the axiom rate is the
 * **current stock** — distinct violating files at the reviewer's most
 * recent scoped run over that spec's applicable opportunities — never a
 * pooled cross-reviewer number (rule 7); populations qualify every
 * violation count (rule 2); epoch segments never sum across a boundary
 * (rule 6); and the calibration banner is unconditional until M6
 * (rule 4).
 */
const buildEvalReportService: Service<BuildEvalReportInput, EvalReport> = (cfg, { scoped }) => {
  const { runs, critiques } = scoped;
  const epochs = deriveEpochsService(cfg, { runs });
  const { axioms } = new AxiomStore(cfg).all();
  const currentUnits = countSpecUnitsService(cfg, {});
  const state = deriveTriageStateService(cfg, {});
  const birthdates = new Map<string, string | null>();

  const matched = critiques.filter((critique) => critique.axiom_id !== null);
  const rows: AxiomReportRow[] = [];

  for (const axiom of axioms) {
    const axiomCritiques = matched.filter((critique) => critique.axiom_id === axiom.id);

    if (axiomCritiques.length === 0) continue;

    for (const reviewerName of distinct(axiomCritiques.map((c) => c.reviewer_name))) {
      rows.push(
        axiomRow({
          axiom,
          reviewerName,
          critiques: axiomCritiques.filter((c) => c.reviewer_name === reviewerName),
          runs,
          epochs,
          currentUnits,
          cfg,
          birthdates,
        }),
      );
    }
  }

  const costs = runs
    .map((run) => run.cost_usd)
    .filter((cost): cost is number => cost !== null && cost !== undefined);

  return {
    scope: scoped.scope,
    panel: {
      runs: runs.length,
      critiques: critiques.length,
      filesTouched: distinct(critiques.map((c) => c.file_path)).length,
      reviewers: distinct(runs.map((run) => run.reviewer_name)),
      specs: distinct(critiques.map((c) => c.spec_path)),
      costUsd: costs.length === 0 ? null : costs.reduce((total, cost) => total + cost, 0),
      costTrend: [...runs]
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
        .map((run) => ({ runId: run.run_id, at: run.timestamp, costUsd: run.cost_usd ?? null })),
    },
    calibration: CALIBRATION_STATUS,
    axioms: rows.sort((a, b) => a.axiomId.localeCompare(b.axiomId)),
    pendingTriage: state.pending.length,
    residual: rateCell(state.dismissed + state.rejectedProposals, critiques.length),
    epochs,
  };
};

export default buildEvalReportService;

/** One axiom × one reviewer: the row (07 rule 7 — never pooled). */
function axiomRow({
  axiom,
  reviewerName,
  critiques,
  runs,
  epochs,
  currentUnits,
  cfg,
  birthdates,
}: {
  axiom: AxiomFile;
  reviewerName: string;
  critiques: LedgerCritiqueRecord[];
  runs: LedgerRunRecord[];
  epochs: EpochSeries[];
  currentUnits: Record<string, number>;
  cfg: PraxisConfig;
  birthdates: Map<string, string | null>;
}): AxiomReportRow {
  const spec = axiom.groundedIn?.split("#")[0] ?? null;

  // Current stock: the reviewer's latest scoped CORPUS run — a one-file
  // fast loop is feedback, not a stock measurement.
  const latestRun = [...runs]
    .filter((run) => run.reviewer_name === reviewerName && run.scope === "corpus")
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];

  const latestViolatingFiles =
    latestRun === undefined
      ? []
      : distinct(
          critiques
            .filter((critique) => critique.run_id === latestRun.run_id)
            .map((critique) => critique.file_path),
        );

  const opportunities =
    (spec === null ? undefined : (latestRun?.spec_units?.[spec] ?? currentUnits[spec])) ?? 0;

  const byPopulation: Record<PopulationQualifier, number> = {
    pre_spec: 0,
    post_spec: 0,
    unknown: 0,
  };

  for (const critique of critiques) {
    const population = derivePopulationService(cfg, {
      filePath: critique.file_path,
      axiomIntroduced: axiom.introduced,
      birthdates,
    });
    byPopulation[population]++;
  }

  const series = epochs.find((entry) => entry.reviewerName === reviewerName);
  const segments = (series?.epochs ?? []).map((epoch) => {
    const epochRunIds = new Set(epoch.runs.map((run) => run.run_id));

    return {
      epochLabel: epoch.openedBy?.label ?? `first epoch (${epoch.reviewerModel})`,
      violations: critiques.filter((critique) => epochRunIds.has(critique.run_id)).length,
      runs: epoch.runs.length,
    };
  });

  return {
    axiomId: axiom.id,
    statement: axiom.statement(),
    severity: axiom.severity,
    reviewerName,
    rate: rateCell(latestViolatingFiles.length, opportunities),
    files: distinct(critiques.map((critique) => critique.file_path)).length,
    byPopulation,
    segments: segments.filter((segment) => segment.violations > 0 || segment.runs > 0),
  };
}

/** Unique values, insertion-ordered. */
function distinct(values: string[]): string[] {
  return [...new Set(values)];
}
