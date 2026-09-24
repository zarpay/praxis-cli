import type { StatusReport } from "@/types.js";
import type { ReportLine, View } from "@framework/types.js";

import { percent } from "@framework/views/stats.js";
import { table } from "@framework/views/table.js";

/**
 * The whole health report `praxis status` prints, in reading order:
 * the document-count table, the per-reviewer validation table,
 * structural findings, and a closing verdict on the project.
 *
 * Framework health only renders when the spec-layer compiler is in use —
 * an eval-only project has no taxonomy to be asked about. The closing
 * line carries the same issue count the command maps to its exit code,
 * so what a reader sees and what CI does can never disagree — both
 * render `issueCount`, computed once where the report is built.
 */
const statusView: View<StatusReport & { json?: boolean }> = (report) => {
  if (report.json) {
    const { json: _json, ...payload } = report;

    return [{ channel: "content", entries: [JSON.stringify(payload, null, 2)] }];
  }

  const lines: ReportLine[] = [{ channel: "heading", text: "Praxis Project Status" }];

  lines.push({ channel: "content", entries: ["", ...evalStateLines(report)] });

  if (report.compilerInUse) {
    const knowledgeTable = table(knowledgeRows(report), ["KNOWLEDGE", "COUNT"]);

    lines.push(
      { channel: "blank" },
      { channel: "heading", text: "Knowledge" },
      { channel: "content", entries: knowledgeTable },
    );
  }

  const coverage = table(coverageRows(report.coverage), ["COVERAGE", "FILES", "RATE"]);

  lines.push(
    { channel: "blank" },
    { channel: "heading", text: "Coverage" },
    { channel: "content", entries: coverage },
  );

  const verdictRows = reviewRows(report);

  if (verdictRows.length > 0) {
    const verdictsTable = table(verdictRows, ["REVIEWER", "PASS", "WARN", "FAIL", "NOT VALIDATED"]);

    lines.push(
      { channel: "blank" },
      { channel: "heading", text: "Verdicts" },
      { channel: "content", entries: verdictsTable },
    );
  }

  const feedbackTable = table(feedbackRows(report.feedback), ["FEEDBACK", "COUNT"]);

  lines.push(
    { channel: "blank" },
    { channel: "heading", text: "Feedback" },
    { channel: "content", entries: feedbackTable },
  );

  if (!report.compilerInUse) return lines;

  for (const { heading, items } of findings(report)) {
    lines.push(
      { channel: "blank" },
      { channel: "warning", text: heading },
      { channel: "content", entries: items.map((item) => `  ${item}`) },
    );
  }

  lines.push({ channel: "blank" });
  lines.push(
    report.issueCount === 0
      ? { channel: "success", text: "No issues found" }
      : { channel: "heading", text: `${report.issueCount} issue(s) found` },
  );

  return lines;
};

export default statusView;

/** The knowledge table's rows: authored documents, plus the active axioms. */
function knowledgeRows(report: StatusReport): (string | number)[][] {
  return [
    ["Experts", report.counts.experts],
    ["Practices", report.counts.practices],
    ["References", report.counts.references],
    ["Context files", report.counts.context],
    ["Axioms", report.counts.axioms],
  ];
}

/** The feedback table's rows: every critique, and where each stands. */
function feedbackRows(feedback: StatusReport["feedback"]): (string | number)[][] {
  return [
    ["Critiques", feedback.critiques],
    ["Labeled", feedback.labeled],
    ["Untriaged", feedback.untriaged],
    ["Awaiting curation", feedback.awaitingCuration],
    ["Dismissed", feedback.dismissed],
    ["Advisory", feedback.advisory],
  ];
}

/**
 * One validation row per reviewer that has reviewed anything.
 *
 * A reviewer with no verdicts at all is dropped rather than rendered as
 * four zeros, which would read as a broken reviewer instead of an unused
 * one. A project with no reviewers configured still gets a row, so its
 * targets are visibly not validated. Rows stay per reviewer, never
 * pooled — reviewers are separate instruments.
 */
function reviewRows(report: StatusReport): (string | number)[][] {
  return report.validation
    .filter((v) => v.pass + v.warn + v.fail + v.notValidated > 0)
    .map((v) => [v.reviewer ?? "none configured", v.pass, v.warn, v.fail, v.notValidated]);
}

/** The framework-health findings, in display order; empty blocks are dropped. */
function findings(report: StatusReport): { heading: string; items: string[] }[] {
  const blocks = [
    {
      heading: "Dangling references (file not found):",
      items: report.danglingRefs.map(({ expert, ref }) => `${expert} → ${ref}`),
    },
    {
      heading: "Orphaned practices (not referenced by any expert):",
      items: report.orphanedPractices,
    },
    { heading: "Experts missing description:", items: report.expertsMissingDescription },
    {
      heading: "Experts that failed to parse:",
      items: report.invalidExperts.map(({ expert, reason }) => `${expert}: ${reason}`),
    },
    {
      heading: "Glob patterns matching zero files:",
      items: report.zeroMatchGlobs.map(({ expert, pattern }) => `${expert}: ${pattern}`),
    },
  ];

  return blocks.filter((block) => block.items.length > 0);
}

/** The situational-poll facts, each naming its command. */
function evalStateLines(report: StatusReport): string[] {
  const { evalState } = report;
  const lastRun = evalState.last_run_at === null ? "never" : lastRunStamp(evalState.last_run_at);

  return [
    `Last run: ${lastRun}`,
    ...(evalState.epoch_boundary_detected
      ? ["Epoch boundary detected — the next full run opens a new baseline."]
      : []),
  ];
}

/** An ISO timestamp as "YYYY-MM-DD HH:MM UTC" — date and time, minute precision. */
function lastRunStamp(iso: string): string {
  const stamp = iso.slice(0, 16).replace("T", " ");

  return `${stamp} UTC`;
}

/** The coverage slices as rows: governed, clearing, and no spec at all — one denominator. */
function coverageRows(coverage: StatusReport["coverage"]): string[][] {
  const unobserved = coverage.sourceFiles - coverage.observed.files;
  const unobservedRate = coverage.sourceFiles === 0 ? null : unobserved / coverage.sourceFiles;

  return [
    [
      "Observed",
      `${coverage.observed.files}/${coverage.sourceFiles}`,
      percent(coverage.observed.rate),
    ],
    [
      "Passing",
      `${coverage.passing.files}/${coverage.sourceFiles}`,
      percent(coverage.passing.rate),
    ],
    ["Not observed", `${unobserved}/${coverage.sourceFiles}`, percent(unobservedRate)],
  ];
}
