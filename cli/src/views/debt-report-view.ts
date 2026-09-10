import type { DebtReport } from "@/types.js";
import type { ReportLine, View } from "@framework/types.js";

import chalk from "chalk";

import { table } from "@framework/views/table.js";

/**
 * The debt surface: honestly named, never charted as agent
 * performance. Stock and paydown per axiom per reviewer, concentration
 * by directory, credit where attributable, and the re-baseline delta
 * with its boundary named.
 */
const debtReportView: View<DebtReport & { json?: boolean }> = (report) => {
  if (report.json) {
    const { json: _json, ...payload } = report;

    return [{ channel: "content", entries: [JSON.stringify(payload, null, 2)] }];
  }

  if (report.rows.length === 0) {
    return [
      { channel: "heading", text: "Debt report — corpus, pre-spec debt included" },
      {
        channel: "content",
        entries: ["No baselined epoch with matched critiques yet. Run a full `praxis eval run`."],
      },
    ];
  }

  const rowTable = table(
    report.rows.map((row) => [
      row.axiomId,
      row.reviewerName,
      row.baselineStock,
      row.currentStock,
      row.paydown,
      row.appearedSinceBaseline,
    ]),
    ["AXIOM", "REVIEWER", "BASELINE", "CURRENT", "PAID DOWN", "APPEARED"],
  );

  const lines: ReportLine[] = [
    { channel: "heading", text: "Debt report — corpus, pre-spec debt included" },
    { channel: "warning", text: `Calibration: ${report.calibration}` },
    {
      channel: "content",
      entries: [...report.evidence.map(evidenceLine), "", ...rowTable],
    },
  ];

  lines.push(...concentrationLines(report));
  lines.push(...creditLines(report));

  if (report.creditNote !== null) {
    lines.push({ channel: "warning", text: report.creditNote });
  }

  if (report.rebaseline !== null) {
    const { boundaryLabel, before, after } = report.rebaseline;

    lines.push({
      channel: "content",
      entries: [
        "",
        `Re-baseline: debt ${before} before ${boundaryLabel}; re-baselined at ${after}.`,
      ],
    });
  }

  return lines;
};

export default debtReportView;

/** Where the current stock lives, worst directories first. */
function concentrationLines(report: DebtReport): ReportLine[] {
  if (report.concentration.length === 0) return [];

  const worst = report.concentration.slice(0, 5);

  return [
    {
      channel: "content",
      entries: [
        "",
        "Concentration (current stock by directory):",
        ...table(
          worst.map((entry) => [entry.directory, entry.violations]),
          ["DIRECTORY", "STOCK"],
        ),
      ],
    },
  ];
}

/** Who resolved what, when the runs were anchored. */
function creditLines(report: DebtReport): ReportLine[] {
  if (report.credits.length === 0) return [];

  return [
    {
      channel: "content",
      entries: [
        "",
        "Paydown credit (authors of resolving commits):",
        ...table(
          report.credits.map((credit) => [credit.author, credit.resolved]),
          ["AUTHOR", "RESOLVED"],
        ),
      ],
    },
  ];
}

/** When a reviewer's stock was last evidenced — the staleness fact. */
function evidenceLine(entry: DebtReport["evidence"][number]): string {
  const baseline = entry.baselineAt.slice(0, 10);
  const current = entry.currentAt.slice(0, 10);

  return chalk.gray(
    `${entry.reviewerName}: baseline ${baseline} · current stock as evidenced ${current}`,
  );
}
