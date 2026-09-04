import type { EvalSummary, ReviewAllResult } from "@/types.js";
import type { DisplayEntry, View } from "@framework/types.js";

import chalk from "chalk";

/** A completed full run, ready to report. */
interface FinishedRun {
  run: ReviewAllResult;
  /** Whether the cache was consulted — a disabled cache is not a cold one. */
  cached: boolean;
}

/**
 * What a finished run reports: the fail-fast notice if it stopped early,
 * the summary block, and the cache tally.
 *
 * The cache line appears only when the cache was consulted — reporting
 * "Hits: 0" for a `--no-cache` run would read as a cold cache rather
 * than a disabled one.
 */
const runReportView: View<FinishedRun> = ({ run, cached }) => [
  ...(run.stoppedEarly
    ? [
        content({
          badge: "STOPPED",
          color: "yellow",
          value: "Review stopped early due to --fail-fast",
        }),
      ]
    : []),
  { channel: "content", entries: summary(run.summary) },
  ...(cached
    ? [
        content({
          badge: "CACHE",
          color: "blue",
          value: `Hits: ${run.cacheStats.hits}, Misses: ${run.cacheStats.misses}`,
        }),
      ]
    : []),
];

export default runReportView;

/** One badge on its own content line, padded from what came before. */
function content(badge: DisplayEntry): { channel: "content"; entries: DisplayEntry[] } {
  return { channel: "content", entries: ["", badge] };
}

/**
 * The aggregated summary block.
 *
 * Reviewers are separate instruments, so their series render separately
 * and are never pooled into one number — the by-reviewer block appears
 * only when there is more than one, because with a single reviewer it
 * would just restate the totals.
 */
function summary(totals: EvalSummary): DisplayEntry[] {
  const reviewerNames = Object.keys(totals.byReviewer);

  return [
    "",
    { header: "Summary — corpus conformance (includes pre-spec debt)" },
    `Total documents: ${totals.total}`,
    { badge: "Compliant", color: "green", value: totals.compliant },
    { badge: "Warnings", color: "yellow", value: totals.warnings },
    { badge: "Errors", color: "red", value: totals.errors },
    totals.unverified > 0 && {
      badge: "Unverified",
      color: "gray",
      value: `${totals.unverified} (could not be reviewed)`,
    },
    totals.notValidated > 0 && {
      badge: "Not Validated",
      color: "gray",
      value: `${totals.notValidated} (no spec found)`,
    },
    "",
    "By type:",
    ...Object.entries(totals.byType).map(
      ([type, stats]) => `  ${type}: ${stats.compliant}/${stats.total} compliant`,
    ),
    ...(reviewerNames.length > 1
      ? ["", "By reviewer:", ...reviewerNames.map((name) => reviewerLine(name, totals))]
      : []),
  ];
}

/** One reviewer's tally, colored per outcome. */
function reviewerLine(name: string, totals: EvalSummary): string {
  const stats = totals.byReviewer[name];
  const pass = chalk.green(String(stats.compliant));
  const warn = chalk.yellow(String(stats.warnings));
  const fail = chalk.red(String(stats.errors));

  return `  ${name}: ${pass} pass, ${warn} warn, ${fail} fail`;
}
