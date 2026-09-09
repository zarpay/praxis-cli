import type { AxiomReport } from "@/types.js";
import type { View } from "@framework/types.js";

import chalk from "chalk";

import { table } from "@framework/views/table.js";

/**
 * One axiom across everything in scope: the standard, per-reviewer
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
      `  ${example.filePath} ${chalk.gray(`[${example.reviewerName}]`)} ${chalk.gray(example.id)}\n    ${chalk.dim(example.text)}\n`,
  );

  return [
    {
      channel: "heading",
      text: severityHeading(report),
    },
    { channel: "warning", text: `Calibration: ${report.calibration}` },
    {
      channel: "content",
      entries: [
        report.statement,
        "",
        `derived from: ${report.derivedFrom ?? "— (not ratified)"} · introduced: ${report.introduced}`,
        "",
        ...table(
          report.rows.map((row) => [
            row.reviewerName,
            `${row.rate.display}${asOf(row)}`,
            row.files,
            row.byPopulation.pre_spec,
            row.byPopulation.post_spec,
            row.byPopulation.unknown,
          ]),
          ["REVIEWER", "CURRENT STOCK", "FILES", "PRE-SPEC", "POST-SPEC", "UNKNOWN"],
        ),
        "",
        ...(examples.length > 0 ? ["Representative critiques:", "", ...examples] : []),
      ],
    },
  ];
};

export default axiomReportView;

/** The heading: identity and status, the severity only when a historical file carries one. */
function severityHeading(report: AxiomReport): string {
  const severity = report.severity === null ? "" : ` (${report.severity}, historical)`;

  return `${report.axiomId} v${report.version} — ${report.status}${severity}`;
}

/** The stock's evidence date, empty when no evidenced corpus run exists. */
function asOf(row: { asOf: string | null }): string {
  return row.asOf === null ? "" : ` (as of ${row.asOf.slice(0, 10)})`;
}
