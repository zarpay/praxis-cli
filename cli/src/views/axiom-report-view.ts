import type { AxiomReport } from "@/types.js";
import type { View } from "@framework/types.js";

import chalk from "chalk";

/**
 * One axiom across everything in scope (07): the standard, per-reviewer
 * current-stock rates with population-qualified counts, and the
 * representative critiques with their ledger ids.
 */
const axiomReportView: View<AxiomReport & { json?: boolean }> = (report) => {
  if (report.json) {
    const { json: _json, ...payload } = report;

    return [{ channel: "content", entries: [JSON.stringify(payload, null, 2)] }];
  }

  const examples = report.examples.map(
    (example) =>
      `  ${chalk.gray(example.id)} ${example.filePath} ${chalk.gray(`[${example.reviewerName}]`)}\n    ${example.text}`,
  );

  return [
    {
      channel: "heading",
      text: `${report.axiomId} v${report.version} — ${report.status} (${report.severity})`,
    },
    { channel: "warning", text: `Calibration: ${report.calibration}` },
    ...(report.driftNote ? [{ channel: "warning" as const, text: report.driftNote }] : []),
    {
      channel: "content",
      entries: [
        report.statement,
        `grounded in: ${report.groundedIn ?? "— (not ratified)"} · introduced: ${report.introduced}`,
        "",
        ...report.rows.map(
          (row) =>
            `[${row.reviewerName}] current stock: ${row.rate.display}${asOf(row)} · files ever flagged: ${row.files} · pre-spec ${row.byPopulation.pre_spec} / post-spec ${row.byPopulation.post_spec} / unknown ${row.byPopulation.unknown}`,
        ),
        ...report.interventions.map(
          (intervention) =>
            `intervention boundary: ${intervention.date} (${intervention.sha.slice(0, 7)}) targeted this axiom — compare rates before/after, never across (08)`,
        ),
        ...(report.agreement
          ? [
              `inter-reviewer agreement: ${report.agreement.corroborated} corroborated file(s) · ${report.agreement.disagreed} single-witness file(s) — a tripwire, not ground truth (06)`,
            ]
          : []),
        ...(examples.length > 0 ? ["", "Representative critiques:", ...examples] : []),
        "",
        "Removal candidacy: `praxis axioms audit` re-runs the authoring gate.",
      ],
    },
  ];
};

export default axiomReportView;

/** The stock's evidence date, empty when no evidenced corpus run exists. */
function asOf(row: { asOf: string | null }): string {
  return row.asOf === null ? "" : ` (as of ${row.asOf.slice(0, 10)})`;
}
