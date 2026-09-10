import type { AxiomReport } from "@/types.js";
import type { View } from "@framework/types.js";

import { card } from "@framework/views/card.js";
import { palette } from "@framework/views/palette.js";
import { table } from "@framework/views/table.js";

/**
 * One axiom across everything in scope: the category's statement,
 * per-reviewer current-stock rates with population-qualified counts,
 * and the representative critiques with their ledger ids.
 */
const axiomReportView: View<AxiomReport & { json?: boolean }> = (report) => {
  if (report.json) {
    const { json: _json, ...payload } = report;

    return [{ channel: "content", entries: [JSON.stringify(payload, null, 2)] }];
  }

  const examples = report.examples.flatMap((example) => [
    `${example.filePath} ${palette.meta(`[${example.reviewerName}]`)} ${palette.meta(example.id)}`,
    palette.quote(`  ${example.text}`),
    "",
  ]);

  const identity = card({
    title: `${report.axiomId} v${report.version}`,
    attrs: [
      ["status", statusMark(report)],
      ["derives from", report.derivedFrom ?? "—"],
      ["introduced", report.introduced],
    ],
    body: [report.statement],
  });

  return [
    { channel: "warning", text: `Calibration: ${report.calibration}` },
    {
      channel: "content",
      entries: [
        "",
        ...identity,
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
        ...(examples.length > 0
          ? ["", palette.structure("Representative critiques"), "", ...examples]
          : []),
      ],
    },
  ];
};

export default axiomReportView;

/** The status dot, with a historical severity noted when a file carries one. */
function statusMark(report: AxiomReport): string {
  const dot =
    report.status === "active" ? palette.good("● active") : palette.meta(`● ${report.status}`);
  const severity =
    report.severity === null ? "" : palette.meta(` · severity ${report.severity} (historical)`);

  return `${dot}${severity}`;
}

/** The stock's evidence date, empty when no evidenced corpus run exists. */
function asOf(row: { asOf: string | null }): string {
  return row.asOf === null ? "" : ` (as of ${row.asOf.slice(0, 10)})`;
}
