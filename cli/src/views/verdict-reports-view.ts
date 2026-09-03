import type { CacheFileData, ReportStatus, ReviewerReports, VerdictReport } from "@/types.js";
import type { DisplayEntry, View } from "@framework/types.js";

import chalk from "chalk";

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
const verdictReportsView: View<ReviewerReports> = ({ reports, named, verbose }) =>
  reports.flatMap(({ reviewer, report }) => [
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

export default verdictReportsView;

/** One reviewer's report: the framed document, status, and findings. */
function reportEntries(report: VerdictReport, verbose: boolean): DisplayEntry[] {
  const { cacheData } = report;
  const issues = cacheData?.result.issues ?? [];
  const showIssues = cacheData && !cacheData.result.compliant && issues.length > 0;

  return [
    "",
    { header: "Validation Report", width: DIVIDER_WIDTH },
    "",
    `  Document:  ${report.targetPath}`,
    cacheData && `  Spec:      ${cacheData.document.spec_path}`,
    cacheData && `  Validated: ${formatDate(cacheData.cached_at)}`,
    "",
    `  Status:    ${statusBadge(report.status)}`,
    ...(report.isStale && cacheData
      ? [
          "",
          { text: "  ! Document has changed since last validation", color: "yellow" as const },
          { text: "    Run `praxis eval run <target>` to re-validate", color: "yellow" as const },
          "",
          `  Last result: ${lastResultSummary(cacheData.result)}`,
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
    "=".repeat(DIVIDER_WIDTH),
  ];
}

/** The status line's colored badge, with its one-line meaning. */
function statusBadge(status: ReportStatus): string {
  switch (status) {
    case "pass":
      return chalk.green("[PASS]") + " Document is compliant";
    case "warn":
      return chalk.yellow("[WARN]") + " Document has warnings";
    case "fail":
      return chalk.red("[FAIL]") + " Document has errors";
    case "stale":
      return chalk.yellow("[STALE]") + " Cached result is outdated";
    case "not_validated":
      return chalk.gray("[NOT VALIDATED]") + " No cached result found";
  }
}

/** Summarizes a cached verdict as `[STATUS] (n issues)` for the staleness block. */
function lastResultSummary(result: CacheFileData["result"]): string {
  const count = result.issues.length;
  const noun = count === 1 ? "issue" : "issues";
  const suffix = count > 0 ? ` (${count} ${noun})` : "";

  return `[${statusLabel(result)}]${suffix}`;
}

/** Maps a cached verdict to its PASS/WARN/FAIL label. */
function statusLabel(result: CacheFileData["result"]): string {
  if (result.compliant) return "PASS";

  return result.severity === "warning" ? "WARN" : "FAIL";
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
