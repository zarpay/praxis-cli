import type { StatusReport } from "@/domains/workspace/types.js";
import type { BadgeEntry, DisplayEntry, ReportLine } from "@/types.js";

import { verdictTally } from "@/views/badges.js";
import { statLines } from "@/views/stats.js";

/** The document-count lines, label-aligned. */
export function countLines(counts: StatusReport["counts"]): string[] {
  return statLines([
    ["Experts", counts.experts],
    ["Practices", counts.practices],
    ["References", counts.references],
    ["Context files", counts.context],
  ]);
}

/**
 * One badge block per reviewer that has reviewed anything.
 *
 * A reviewer with no verdicts at all is dropped rather than rendered as
 * four zeros, which reads as a broken reviewer instead of an unused one.
 *
 * A project with no reviewers configured still has a row — its targets are
 * all unvalidated, which is worth saying — so the nameless reader gets
 * a label rather than rendering as "null".
 */
export function validationBlocks(
  validation: StatusReport["validation"],
): { reviewer: string; badges: BadgeEntry[] }[] {
  return validation
    .filter((v) => v.pass + v.warn + v.fail + v.notValidated > 0)
    .map((v) => ({ reviewer: v.reviewer ?? "none configured", badges: verdictTally(v) }));
}

/**
 * The framework-health findings a report carries, in display order.
 *
 * Blocks with nothing to report are dropped, so the caller renders
 * every block it is given and the count of findings is the sum of their
 * items.
 */
export function issueBlocks(report: StatusReport): { heading: string; items: string[] }[] {
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
    {
      heading: "Practices with unknown owners:",
      items: report.unmatchedOwners.map(({ practice, owner }) => `${practice} (owner: ${owner})`),
    },
  ];

  return blocks.filter((block) => block.items.length > 0);
}

/**
 * The guidance shown after scaffolding a project.
 *
 * Rendered by `praxis init`; the orchestrator decides *which* steps
 * apply, this only frames them.
 */
export function nextStepsEntries(steps: string[]): DisplayEntry[] {
  return ["", "Next steps:", ...steps];
}

/**
 * The whole health report, in order, ready to print.
 *
 * Framework health only renders when the spec-layer compiler is in use:
 * an eval-only project has no taxonomy to be asked about, so it gets
 * review state and nothing else.
 *
 * The closing line is the verdict on the project — "no issues found",
 * or a count — and it is the same count the command maps to its exit
 * code, so what a reader sees and what CI does can never disagree.
 */
export function statusReport(report: StatusReport): ReportLine[] {
  const lines: ReportLine[] = [{ channel: "heading", text: "Praxis Project Status" }];

  if (report.compilerInUse) {
    lines.push({ channel: "content", entries: ["", ...countLines(report.counts)] });
  }

  for (const { reviewer, badges } of validationBlocks(report.validation)) {
    lines.push(
      { channel: "blank" },
      { channel: "heading", text: `Validation (reviewer: ${reviewer})` },
      { channel: "content", entries: badges },
    );
  }

  if (!report.compilerInUse) return lines;

  const blocks = issueBlocks(report);

  for (const { heading, items } of blocks) {
    lines.push(
      { channel: "blank" },
      { channel: "warning", text: heading },
      { channel: "content", entries: items.map((item) => `  ${item}`) },
    );
  }

  const issues = blocks.reduce((total, block) => total + block.items.length, 0);

  lines.push({ channel: "blank" });
  lines.push(
    issues === 0
      ? { channel: "success", text: "No issues found" }
      : { channel: "heading", text: `${issues} issue(s) found` },
  );

  return lines;
}
