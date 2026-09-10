import type { EvalSummary, ReviewAllResult } from "@/types.js";
import type { DisplayEntry, View } from "@framework/types.js";

import { badge, verdictTally } from "@framework/views/badges.js";
import { palette } from "@framework/views/palette.js";
import { table } from "@framework/views/table.js";

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
    ? [content(badge("STOPPED", "yellow", "Review stopped early due to --fail-fast"))]
    : []),
  { channel: "content", entries: summary(run.summary) },
  ...(cached
    ? [
        content(
          badge("CACHE", "blue", `Hits: ${run.cacheStats.hits}, Misses: ${run.cacheStats.misses}`),
        ),
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

  const tally = verdictTally({
    pass: totals.compliant,
    warn: totals.warnings,
    fail: totals.errors,
    notValidated: totals.notValidated,
  });

  return [
    "",
    { header: "Summary — corpus conformance (includes pre-spec debt)" },
    `Total documents: ${totals.total}`,
    "",
    `  ${tally}`,
    totals.unverified > 0 &&
      `  ${palette.warn(`● ${totals.unverified} unverified`)} ${palette.meta("(could not be reviewed — the run fails)")}`,
    "",
    "By type:",
    ...table(
      Object.entries(totals.byType).map(([type, stats]) => [
        type,
        `${stats.compliant}/${stats.total} compliant`,
      ]),
      ["TYPE", "COMPLIANT"],
    ),
    ...(reviewerNames.length > 1
      ? [
          "",
          "By reviewer:",
          ...table(
            reviewerNames.map((name) => {
              const stats = totals.byReviewer[name];

              return [name, stats?.compliant ?? 0, stats?.warnings ?? 0, stats?.errors ?? 0];
            }),
            ["REVIEWER", "PASS", "WARN", "FAIL"],
          ),
        ]
      : []),
  ];
}
