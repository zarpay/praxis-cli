import type { DiffTargetOutcome, LedgerFlow, ReviewDiffResult } from "@/types.js";
import type { DisplayEntry, ReportLine, View } from "@framework/types.js";

import chalk from "chalk";

/**
 * What a finished diff run reports (12): per file, each finding under
 * its flow label — the diff is judged on what it *introduced*;
 * inherited debt and resolutions are shown, never blamed. Open-channel
 * critiques carry no label (no axiom identity to diff on) and flow to
 * triage as ever.
 */
const diffReportView: View<ReviewDiffResult> = ({ perTarget, summary, cacheStats }) => {
  const lines: ReportLine[] = [];

  for (const outcome of perTarget) {
    lines.push({ channel: "content", entries: targetEntries(outcome) });
  }

  const gate =
    summary.errorsIntroduced + summary.unverified === 0
      ? { channel: "success" as const, text: "No introduced errors — the diff is clean" }
      : {
          channel: "warning" as const,
          text: `${summary.errorsIntroduced} introduced error(s), ${summary.unverified} unverified — the diff fails`,
        };

  lines.push({ channel: "blank" });
  lines.push({
    channel: "content",
    entries: [
      { header: "Diff summary — the branch's own contribution" },
      { badge: "Introduced", color: "red", value: summary.introduced },
      { badge: "Resolved", color: "green", value: summary.resolved },
      { badge: "Inherited", color: "gray", value: `${summary.inherited} (pre-existing debt)` },
      summary.unverified > 0 && {
        badge: "Unverified",
        color: "gray",
        value: `${summary.unverified} (could not compare)`,
      },
      "",
      {
        badge: "CACHE",
        color: "blue",
        value: `Hits: ${cacheStats.hits}, Misses: ${cacheStats.misses}`,
      },
    ],
  });
  lines.push(gate);

  return lines;
};

export default diffReportView;

/** One file's outcome: its status badge, findings, and resolutions. */
function targetEntries(outcome: DiffTargetOutcome): DisplayEntry[] {
  const label = `${outcome.relPath}${outcome.status === "deleted" ? " (deleted)" : ""}`;

  if (outcome.unverified) {
    return [{ badge: "UNVERIFIED", color: "gray", value: `${label} — flow withheld` }];
  }

  const clean = outcome.findings.length === 0 && outcome.resolved.length === 0;

  return [
    badgeFor(label, outcome),
    ...outcome.findings.map(findingLine),
    ...outcome.resolved.map(
      (critique) => `  - ${flowLabel("resolved")} ${cite(critique.axiomId)}${critique.text}`,
    ),
    ...(clean ? [] : []),
  ];
}

/** The file's badge: introduced errors dominate, then warns, then pass. */
function badgeFor(label: string, outcome: DiffTargetOutcome): DisplayEntry {
  const introducedError = outcome.findings.some(
    (finding) => finding.flow === "introduced" && finding.severity === "error",
  );

  if (introducedError) return { badge: "FAIL", color: "red", value: label };

  if (outcome.findings.some((finding) => finding.flow === "introduced")) {
    return { badge: "WARN", color: "yellow", value: label };
  }

  return { badge: "PASS", color: "green", value: label };
}

/** One after-side finding, flow-labeled. */
function findingLine(finding: DiffTargetOutcome["findings"][number]): string {
  return `  - ${flowLabel(finding.flow)} ${cite(finding.critique.axiomId)}${finding.critique.text}`;
}

/** The colored flow tag; open-channel findings carry none. */
function flowLabel(flow: LedgerFlow | null): string {
  if (flow === "introduced") return chalk.red("[introduced]");

  if (flow === "resolved") return chalk.green("[resolved]");

  if (flow === "inherited") return chalk.gray("[inherited]");

  return chalk.gray("[open]");
}

/** The axiom citation prefix for a matched finding. */
function cite(axiomId: string | null): string {
  return axiomId === null ? "" : `${chalk.cyan(`[${axiomId}]`)} `;
}
