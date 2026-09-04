import type { AxiomReport, AxiomReportRow, ScopedLedger, Service } from "@/types.js";

import { errors } from "@/helpers/errors-helper.js";
import { rateCell } from "@/helpers/metrics-helper.js";
import buildEvalReportService from "@/services/build-eval-report-service.js";
import { AxiomStore } from "@/stores/axiom-store.js";

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
