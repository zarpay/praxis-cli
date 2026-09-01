import type { EvalSummary, Verdict } from "@/domains/eval/types.js";
import type { DisplayEntry } from "@/types.js";

import chalk from "chalk";

/**
 * The aggregated summary block for a completed run.
 *
 * Reviewers are separate instruments, so their series render
 * separately and are never pooled into one number — the by-reviewer
 * block appears only when there is more than one, because with a single
 * reviewer it would just restate the totals.
 */
export function summaryEntries(summary: EvalSummary): DisplayEntry[] {
  const reviewerNames = Object.keys(summary.byReviewer);

  return [
    "",
    { header: "Summary" },
    `Total documents: ${summary.total}`,
    { badge: "Compliant", color: "green", value: summary.compliant },
    { badge: "Warnings", color: "yellow", value: summary.warnings },
    { badge: "Errors", color: "red", value: summary.errors },
    summary.notValidated > 0 && {
      badge: "Not Validated",
      color: "gray",
      value: `${summary.notValidated} (no spec found)`,
    },
    "",
    "By type:",
    ...Object.entries(summary.byType).map(
      ([type, stats]) => `  ${type}: ${stats.compliant}/${stats.total} compliant`,
    ),
    ...(reviewerNames.length > 1
      ? ["", "By reviewer:", ...reviewerNames.map((name) => byReviewer(name, summary))]
      : []),
  ];
}

/** One reviewer's tally, colored per outcome. */
function byReviewer(name: string, summary: EvalSummary): string {
  const stats = summary.byReviewer[name];

  return `  ${name}: ${chalk.green(String(stats.compliant))} pass, ${chalk.yellow(String(stats.warnings))} warn, ${chalk.red(String(stats.errors))} fail`;
}

/** One target's verdict line, with its issues and optional reasoning. */
export function verdictEntries(path: string, verdict: Verdict, verbose: boolean): DisplayEntry[] {
  return [
    verdictBadge(path, verdict),
    ...(verdict.compliant ? [] : verdict.issues.map((issue) => `  - ${issue}`)),
    ...(verbose ? ["", "Reasoning:", verdict.reason] : []),
  ];
}

/** The colored status badge for one verdict. */
export function verdictBadge(path: string, verdict: Verdict): DisplayEntry {
  if (verdict.compliant) return { badge: "PASS", color: "green", value: path };

  if (verdict.severity === "warning") return { badge: "WARN", color: "yellow", value: path };

  return { badge: "FAIL", color: "red", value: path };
}
