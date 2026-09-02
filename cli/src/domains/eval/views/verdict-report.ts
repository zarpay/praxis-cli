import type { CacheFileData, ReportStatus, VerdictReport } from "@/domains/eval/types.js";
import type { DisplayEntry } from "@/framework/types.js";

import chalk from "chalk";

/** Width of the divider rules framing a report. */
const DIVIDER_WIDTH = 50;

/**
 * A verdict report as printable entries.
 *
 * A stale report leads with the warning and what to do about it, then
 * shows the last result — the reader needs to know the verdict is
 * describing inputs that have since changed before they read it.
 */
export function verdictReportEntries(report: VerdictReport, verbose: boolean): DisplayEntry[] {
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
    ...(showIssues ? ["", "  Issues:", ...issues.map((i) => `    - ${i}`)] : []),
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

/** Formats a status enum into a colored badge string. */
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

/** Formats an ISO date string into a human-readable local string. */
function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString();
  } catch {
    return isoString;
  }
}
