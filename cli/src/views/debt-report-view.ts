import type { DebtReport } from "@/types.js";
import type { ReportLine, View } from "@framework/types.js";

import chalk from "chalk";

/**
 * The debt surface (02, 07): honestly named, never charted as agent
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

  const lines: ReportLine[] = [
    { channel: "heading", text: "Debt report — corpus, pre-spec debt included" },
    { channel: "warning", text: `Calibration: ${report.calibration}` },
    { channel: "content", entries: report.rows.map(rowLine) },
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

/** One axiom's stock movement, one reviewer's series. */
function rowLine(row: DebtReport["rows"][number]): string {
  const paid = chalk.green(String(row.paydown));
  const appeared = chalk.red(String(row.appearedSinceBaseline));

  return `${row.axiomId} ${chalk.gray(`[${row.reviewerName}]`)} baseline ${row.baselineStock} → current ${row.currentStock} · paid down ${paid} · appeared since baseline ${appeared}`;
}

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
        ...worst.map((entry) => `  ${entry.directory}: ${entry.violations}`),
      ],
    },
  ];
}

/** Who resolved what, when the runs were anchored (02). */
function creditLines(report: DebtReport): ReportLine[] {
  if (report.credits.length === 0) return [];

  return [
    {
      channel: "content",
      entries: [
        "",
        "Paydown credit (authors of resolving commits, 02):",
        ...report.credits.map((credit) => `  ${credit.author}: ${credit.resolved} resolved`),
      ],
    },
  ];
}
