import type { AxiomReport, AxiomReportRow, BuildAxiomReportInput } from "@/types.js";

import { errors } from "@/helpers/errors-helper.js";
import { rateCell } from "@/helpers/metrics-helper.js";
import { AxiomStore } from "@/models/axiom-store.js";
import { PraxisConfig } from "@/models/praxis-config.js";
import buildEvalReportService from "@/services/build-eval-report-service.js";

/**
 * The single-axiom drill-down (07): the standard itself, its per-
 * reviewer rows from the scoped evidence, and representative critiques
 * with ledger ids — the depth the fast loop's token economy deliberately
 * leaves behind `axioms show` and this report (09).
 *
 * @throws PraxisError when no axiom carries the id
 */
export default function buildAxiomReport({
  root,
  scoped,
  axiomId,
}: BuildAxiomReportInput): AxiomReport {
  const { axioms } = new AxiomStore({ projectRoot: root }).all();
  const axiom = axioms.find((candidate) => candidate.id === axiomId);

  if (!axiom) throw errors.axiomNotFound(axiomId);

  const report = buildEvalReportService({ root, config: new PraxisConfig(root), scoped });
  const evidenceRows = report.axioms.filter((row) => row.axiomId === axiomId);

  // An axiom nobody has violated in scope still reports: one empty row,
  // its zero-opportunity cell suppressed by the floor.
  const noEvidenceRow: AxiomReportRow = {
    axiomId: axiom.id,
    statement: axiom.statement(),
    severity: axiom.severity,
    reviewerName: "—",
    rate: rateCell(0, 0),
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
}
