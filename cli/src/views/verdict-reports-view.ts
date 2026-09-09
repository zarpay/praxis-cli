import type { CacheFileData, VerdictReportStatus, VerdictReport } from "@/types.js";
import type { BadgeEntry, DisplayEntry, View } from "@framework/types.js";

import chalk from "chalk";

import { badgeBlock } from "@framework/views/badges.js";
import { rule } from "@framework/views/rule.js";
import { statLines } from "@framework/views/stats.js";

/** Every reviewer's cached report on one target. */
interface ReviewerReports {
  reports: { reviewer: string; report: VerdictReport }[];
  /** Name each reviewer — only when several could disagree. */
  named: boolean;
  /** Show the full reasoning. */
  verbose: boolean;
  /** Emit the stable machine contract instead. */
  json?: boolean;
}

/** Width of the divider rules framing a report. */
const DIVIDER_WIDTH = 50;

/**
 * Every reviewer's cached report on one target, framed per reviewer when
 * several ran and could disagree.
 *
 * A stale report leads with the warning and what to do about it, then
 * shows the last result — the reader needs to know the verdict describes
 * inputs that have since changed before they read it.
 */
const verdictReportsView: View<ReviewerReports> = ({ reports, named, verbose, json }) => {
  if (json) {
    const payload = reports.map(({ reviewer, report }) => ({
      reviewer,
      target: report.targetPath,
      status: report.status,
      stale: report.isStale,
    }));

    return [{ channel: "content", entries: [JSON.stringify(payload, null, 2)] }];
  }

  return reports.flatMap(({ reviewer, report }) => [
    ...(named
      ? [
          {
            channel: "content" as const,
            entries: ["", { text: `Reviewer: ${reviewer}`, color: "cyan" as const }],
          },
        ]
      : []),
    { channel: "content" as const, entries: reportEntries(report, verbose) },
  ]);
};

export default verdictReportsView;

/** One reviewer's report: the framed document, status, and findings. */
function reportEntries(report: VerdictReport, verbose: boolean): DisplayEntry[] {
  const { cacheData } = report;
  const issues = cacheData?.result.issues ?? [];
  const showIssues = cacheData && !cacheData.result.compliant && issues.length > 0;

  const documentFacts: [string, string | number][] = [
    ["Document", report.targetPath],
    ...(cacheData
      ? ([
          ["Spec", cacheData.document.spec_path],
          ["Validated", formatDate(cacheData.cached_at)],
        ] as [string, string | number][])
      : []),
  ];

  return [
    "",
    { header: "Validation Report", width: DIVIDER_WIDTH },
    "",
    ...statLines(documentFacts),
    "",
    ...statusBadge(report.status),
    ...(report.isStale && cacheData
      ? [
          "",
          { text: "  ! Document has changed since last validation", color: "yellow" as const },
          { text: "    Run `praxis eval run <target>` to re-validate", color: "yellow" as const },
          "",
          "  Last result:",
          ...lastResultBadge(cacheData.result),
        ]
      : []),
    ...(showIssues
      ? ["", "  Issues:", ...issues.map((issue) => `    - ${issueLabel(issue)}${issue.text}`)]
      : []),
    ...(report.status === "not_validated"
      ? ["", `  Run ${chalk.cyan("`praxis eval run " + report.targetPath + "`")} to validate.`]
      : []),
    ...(verbose && cacheData
      ? ["", { header: "AI Reasoning:", char: "-", width: DIVIDER_WIDTH }, cacheData.result.reason]
      : []),
    "",
    rule("=", DIVIDER_WIDTH),
  ];
}

/** The status badge line, with its one-line meaning. */
function statusBadge(status: VerdictReportStatus): BadgeEntry[] {
  switch (status) {
    case "pass":
      return badgeBlock([["PASS", "green", "Document is compliant"]]);
    case "warn":
      return badgeBlock([["WARN", "yellow", "Document has warnings"]]);
    case "fail":
      return badgeBlock([["FAIL", "red", "Document has errors"]]);
    case "stale":
      return badgeBlock([["STALE", "yellow", "Cached result is outdated"]]);
    case "not_validated":
      return badgeBlock([["NOT VALIDATED", "gray", "No cached result found"]]);
  }
}

/** The stale block's summary of the outdated verdict: its badge and issue count. */
function lastResultBadge(result: CacheFileData["result"]): BadgeEntry[] {
  const count = result.issues.length;
  const noun = count === 1 ? "issue" : "issues";
  const value = count > 0 ? `${count} ${noun}` : "no issues";

  if (result.compliant) return badgeBlock([["PASS", "green", value]]);

  if (result.severity === "warning") return badgeBlock([["WARN", "yellow", value]]);

  return badgeBlock([["FAIL", "red", value]]);
}

/** A locale date for the report; the raw ISO string when unparsable. */
function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString();
  } catch {
    return isoString;
  }
}

/** The axiom citation prefix for a matched critique; empty on the open channel. */
function issueLabel(issue: { axiomId: string | null }): string {
  return issue.axiomId === null ? "" : chalk.cyan(`[${issue.axiomId}] `);
}
