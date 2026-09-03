import type { StatusReport } from "@/types.js";
import type { BadgeEntry, ReportLine, View } from "@framework/types.js";

import { verdictTally } from "@framework/views/badges.js";
import { statLines } from "@framework/views/stats.js";

/**
 * The whole health report `praxis status` prints, in reading order:
 * document counts, one review-state block per reviewer, structural
 * findings, and a closing verdict on the project.
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
    lines.push({ channel: "content", entries: ["", ...counts(report)] });
  }

  for (const { reviewer, badges } of reviewBlocks(report)) {
    lines.push(
      { channel: "blank" },
      { channel: "heading", text: `Validation (reviewer: ${reviewer})` },
      { channel: "content", entries: badges },
    );
  }

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

/** The aligned document-count block. */
function counts(report: StatusReport): string[] {
  return statLines([
    ["Experts", report.counts.experts],
    ["Practices", report.counts.practices],
    ["References", report.counts.references],
    ["Context files", report.counts.context],
  ]);
}

/**
 * One tally block per reviewer that has reviewed anything.
 *
 * A reviewer with no verdicts at all is dropped rather than rendered as
 * four zeros, which would read as a broken reviewer instead of an unused
 * one. A project with no reviewers configured still gets a row, so its
 * targets are visibly not validated.
 */
function reviewBlocks(report: StatusReport): { reviewer: string; badges: BadgeEntry[] }[] {
  return report.validation
    .filter((v) => v.pass + v.warn + v.fail + v.notValidated > 0)
    .map((v) => ({ reviewer: v.reviewer ?? "none configured", badges: verdictTally(v) }));
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

/** The situational-poll facts, each naming its command (09). */
function evalStateLines(report: StatusReport): string[] {
  const { evalState } = report;
  const lastRun = evalState.last_run_at === null ? "never" : evalState.last_run_at.slice(0, 10);

  return [
    `Last run: ${lastRun} · Pending triage: ${evalState.pending_triage} · Proposals awaiting ratification: ${evalState.proposals_pending}`,
    ...(evalState.epoch_boundary_detected
      ? ["Epoch boundary detected — the next full run opens a new baseline."]
      : []),
  ];
}
