import type { AxiomReport, AxiomReportRow, ScopedLedger, Service } from "@/types.js";
import type { LedgerCritiqueRecord } from "@/types.js";

import { errors } from "@/helpers/errors-helper.js";
import { interventionsFor } from "@/helpers/git-helper.js";
import { rateCell } from "@/helpers/metrics-helper.js";
import buildEvalReportService from "@/services/build-eval-report-service.js";
import { AxiomStore } from "@/stores/axiom-store.js";
import { CalibrationStore } from "@/stores/calibration-store.js";

/** The single-axiom drill-down's inputs. */
interface BuildAxiomReportInput {
  scoped: ScopedLedger;
  axiomId: string;
}

/**
 * The single-axiom drill-down (07): the standard itself, its per-
 * reviewer rows from the scoped evidence, and representative critiques
 * with ledger ids — the depth the fast loop's token economy deliberately
 * leaves behind `axioms show` and this report (09).
 *
 * @throws PraxisError when no axiom carries the id
 */
const buildAxiomReportService: Service<BuildAxiomReportInput, AxiomReport> = (
  cfg,
  { scoped, axiomId },
) => {
  const { axioms } = new AxiomStore(cfg).all();
  const axiom = axioms.find((candidate) => candidate.id === axiomId);

  if (!axiom) throw errors.axiomNotFound(axiomId);

  const report = buildEvalReportService(cfg, { scoped });
  const evidenceRows = report.axioms.filter((row) => row.axiomId === axiomId);

  // An axiom nobody has violated in scope still reports: one empty row,
  // its zero-opportunity cell suppressed by the floor.
  const noEvidenceRow: AxiomReportRow = {
    axiomId: axiom.id,
    statement: axiom.statement(),
    severity: axiom.severity,
    reviewerName: "—",
    rate: rateCell(0, 0),
    asOf: null,
    files: 0,
    byPopulation: { pre_spec: 0, post_spec: 0, unknown: 0 },
    segments: [],
  };

  const rows = evidenceRows.length > 0 ? evidenceRows : [noEvidenceRow];

  const examples = scoped.critiques
    .filter((critique) => critique.axiom_id === axiomId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 5)
    .map((critique) => ({
      id: critique.id,
      filePath: critique.file_path,
      reviewerName: critique.reviewer_name,
      text: critique.text,
    }));

  return {
    axiomId: axiom.id,
    calibration: report.calibration,
    driftNote: driftNoteOf(
      new CalibrationStore(cfg),
      cfg.reviewers.map((r) => r.name),
      axiomId,
    ),
    agreement: agreementOf(scoped.critiques, axiomId, cfg.reviewers.length),
    interventions: interventionsFor(cfg.root, axiomId),
    statement: axiom.statement(),
    status: axiom.status,
    severity: axiom.severity,
    groundedIn: axiom.groundedIn,
    introduced: axiom.introduced,
    version: axiom.version,
    rows,
    examples,
  };
};

export default buildAxiomReportService;

/**
 * A drift annotation when any reviewer's latest calibration flagged
 * this axiom (06): the trend line has a discontinuity to name.
 */
function driftNoteOf(
  store: CalibrationStore,
  reviewerNames: string[],
  axiomId: string,
): string | null {
  const flaggedBy: string[] = [];

  for (const name of reviewerNames) {
    const latest = store.latestByName(name);

    if (latest?.drift_flagged.includes(axiomId)) {
      flaggedBy.push(`${name} at ${latest.timestamp.slice(0, 10)}`);
    }
  }

  if (flaggedBy.length === 0) return null;

  return `calibration drift flagged by ${flaggedBy.join(", ")} — rates across this boundary are not comparable (06)`;
}

/**
 * Corroboration and disagreement over the scoped evidence (06-p): per
 * flagged file, how many distinct reviewers stand behind the finding.
 * Meaningless with one reviewer, so null then.
 */
function agreementOf(
  critiques: LedgerCritiqueRecord[],
  axiomId: string,
  reviewerCount: number,
): { corroborated: number; disagreed: number } | null {
  if (reviewerCount < 2) return null;

  const witnesses = new Map<string, Set<string>>();

  for (const critique of critiques) {
    if (critique.axiom_id !== axiomId || critique.flow === "resolved") continue;

    const held = witnesses.get(critique.file_path) ?? new Set<string>();
    held.add(critique.reviewer_name);
    witnesses.set(critique.file_path, held);
  }

  let corroborated = 0;
  let disagreed = 0;

  for (const reviewers of witnesses.values()) {
    if (reviewers.size >= 2) corroborated++;
    else disagreed++;
  }

  return { corroborated, disagreed };
}
