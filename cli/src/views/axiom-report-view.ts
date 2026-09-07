import type { AxiomReport } from "@/types.js";
import type { View } from "@framework/types.js";

import chalk from "chalk";

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
      text: `${report.axiomId} v${report.version} — ${report.status} (${report.severity})`,
    },
    { channel: "warning", text: `Calibration: ${report.calibration}` },
    {
      channel: "content",
      entries: [
        report.statement,
        "",
        `derived from: ${report.derivedFrom ?? "— (not ratified)"} · introduced: ${report.introduced}`,
        "",
        ...report.rows.flatMap((row) => [
          `[${row.reviewerName}]`,
          `  current stock: ${row.rate.display}${asOf(row)} · files ever flagged: ${row.files}`,
          `  critiques by population: pre-spec ${row.byPopulation.pre_spec} · post-spec ${row.byPopulation.post_spec} · unknown ${row.byPopulation.unknown}`,
          "",
        ]),
        ...(examples.length > 0 ? ["Representative critiques:", "", ...examples] : []),
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
