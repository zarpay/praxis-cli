import type { AxiomReportRow, EvalReport, FlowRow } from "@/types.js";
import type { ReportLine, View } from "@framework/types.js";

import chalk from "chalk";

/**
 * The eval report, rendered under 07's hard rules: the calibration
 * banner first (rule 4), every rate beside its denominator (rule 3),
 * one reviewer one series (rule 7), populations qualifying counts
 * (rule 2), epoch boundaries as named furniture (rule 6), and 12's
 * missing-commit note for shas this clone can no longer resolve.
 */
const evalReportView: View<EvalReport & { json?: boolean }> = (report) => {
  if (report.json) {
    const { json: _json, ...payload } = report;

    return [{ channel: "content", entries: [JSON.stringify(payload, null, 2)] }];
  }

  const lines: ReportLine[] = [];

  for (const missing of report.scope.unresolvableShas) {
    lines.push({ channel: "warning", text: missingCommitNote(missing) });
  }

  lines.push(
    { channel: "heading", text: "Eval report" },
    { channel: "warning", text: `Calibration: ${report.calibration}` },
    {
      channel: "content",
      entries: [
        `Runs: ${report.panel.runs} · Critiques: ${report.panel.critiques} · Files touched: ${report.panel.filesTouched}`,
        `Reviewers: ${report.panel.reviewers.join(", ") || "—"} · Specs: ${report.panel.specs.length}`,
        `Cost: ${report.panel.costUsd === null ? "— (offline or unreported)" : `$${report.panel.costUsd.toFixed(4)}`}`,
        "",
      ],
    },
  );

  lines.push(...epochLines(report));
  lines.push(...axiomLines(report.axioms));
  lines.push(...flowLines(report.flow));

  lines.push({
    channel: "content",
    entries: [
      "",
      `Pending triage: ${report.pendingTriage} (\`praxis axioms triage\`)`,
      `Residual (dismissed + rejected over critiques): ${report.residual.display}`,
    ],
  });

  return lines;
};

export default evalReportView;

/** 12's note, verbatim in shape: expiry is a lifecycle event, not corruption. */
function missingCommitNote(missing: {
  sha: string;
  branch: string | null;
  at: string | null;
}): string {
  const recorded =
    missing.at === null ? "" : ` (branch ${missing.branch ?? "—"}, ${missing.at.slice(0, 10)})`;

  return `Commit ${missing.sha.slice(0, 7)}${recorded} is not reachable in this clone. The record is sound — praxis read the sha from a provably clean tree when the run happened — but the commit has since left this clone's history. Most likely, in order: the branch was squash-merged or rebased, so the same work now lives under a different sha; the commit was never pushed from the machine that ran the eval; this clone is shallow or unfetched (\`git fetch --all --unshallow\` may recover it); or the branch was deleted unmerged. The evidence still stands either way: the critique's content hashes attest exactly what was reviewed. To relocate the reviewed code, match target_content_hash against the file's surviving history (\`git log --all -- <file_path>\`).`;
}

/** Epoch boundaries as named, first-class furniture (07 rule 6). */
function epochLines(report: EvalReport): ReportLine[] {
  const boundaries = report.epochs.flatMap((series) =>
    series.epochs
      .filter((epoch) => epoch.openedBy !== null)
      .map(
        (epoch) =>
          `── epoch: ${series.reviewerName} · ${epoch.openedBy!.label} · ${epoch.openedBy!.at.slice(0, 10)} · ${epoch.reviewerHash} ──`,
      ),
  );

  if (boundaries.length === 0) return [];

  return [{ channel: "content", entries: [...boundaries.map((line) => chalk.gray(line)), ""] }];
}

/** The per-axiom table: one reviewer, one series (07 rule 7). */
function axiomLines(rows: AxiomReportRow[]): ReportLine[] {
  if (rows.length === 0) {
    return [{ channel: "content", entries: ["No matched critiques in scope."] }];
  }

  const entries = rows.map((row) => {
    const populations = `pre-spec ${row.byPopulation.pre_spec} · post-spec ${row.byPopulation.post_spec} · unknown ${row.byPopulation.unknown}`;

    return [
      `${row.axiomId} ${chalk.gray(`[${row.reviewerName}]`)} ${row.statement}`,
      `  current stock: ${row.rate.display}${asOf(row)} · critiques by population: ${populations}`,
      ...row.segments.map(
        (segment) =>
          `  ${chalk.gray(`${segment.epochLabel}: ${segment.violations} critiques over ${segment.runs} runs`)}`,
      ),
    ].join("\n");
  });

  return [{ channel: "content", entries }];
}

/**
 * The flow section (01): each branch's latest diff run per reviewer,
 * within the current epoch. The introduction rate is the eval's number
 * — post-spec introduced violations per applicable opportunity — and
 * renders floor-aware like every other rate.
 */
function flowLines(flow: EvalReport["flow"]): ReportLine[] {
  if (flow === null) return [];

  return [
    { channel: "blank" },
    {
      channel: "heading",
      text: `Violation flow — latest diff run per branch (${flow.runsConsidered} run(s))`,
    },
    { channel: "content", entries: flow.rows.map(flowLine) },
  ];
}

/** One axiom × reviewer flow row. */
function flowLine(row: FlowRow): string {
  const populations = `pre-spec ${row.introducedByPopulation.pre_spec} / post-spec ${row.introducedByPopulation.post_spec} / unknown ${row.introducedByPopulation.unknown}`;

  return `${row.axiomId} ${chalk.gray(`[${row.reviewerName}]`)} introduced ${row.introduced} · resolved ${row.resolved} · inherited ${row.inherited} · introduction rate ${row.introductionRate.display} (${populations})`;
}

/** The stock's evidence date, empty when no evidenced corpus run exists. */
function asOf(row: { asOf: string | null }): string {
  return row.asOf === null ? "" : ` (as of ${row.asOf.slice(0, 10)})`;
}
