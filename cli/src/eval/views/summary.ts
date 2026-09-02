import type {
  EvalProgress,
  EvalSummary,
  ReviewAllResult,
  Verdict,
  VerdictReport,
} from "@/eval/types.js";
import type { DisplayEntry, ReportLine } from "@/framework/types.js";

import chalk from "chalk";

import { unitHeading, verdictMark } from "@/eval/views/progress.js";
import { verdictReportEntries } from "@/eval/views/verdict-report.js";

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

/** What a full run announces before it starts. */
export function runHeadline({ ci, type }: { ci?: boolean; type?: string }): string {
  if (ci) return "Running CI review...";

  return type ? `Reviewing all ${type} documents...` : "Reviewing all documents...";
}

/**
 * What a targeted run announces before it starts.
 *
 * One target is named; several are counted, because listing them would
 * bury the progress that follows.
 */
export function targetsHeadline(targets: string[]): string {
  return `Reviewing ${targets.length === 1 ? targets[0] : `${targets.length} targets`}...`;
}

/** One progress event as it happens: the heading, the mark, or the failure. */
export function progressEntries(event: EvalProgress): DisplayEntry[] {
  if (event.kind === "unit-start") {
    return ["", unitHeading(event)];
  }

  if (event.kind === "verdict") {
    return [
      `\t${verdictMark(event.verdict)}`,
      ...(event.verdict.compliant
        ? []
        : event.verdict.issues.map((issue) => `\t${chalk.dim("·")} ${issue}`)),
    ];
  }

  return [`\t${chalk.red("✗ ERROR")}`, `\t${chalk.dim("·")} ${event.message}`];
}

/**
 * What a finished run reports: the fail-fast notice, the summary, and
 * the cache tally.
 *
 * The cache line appears only when the cache was consulted — reporting
 * "Hits: 0" for a `--no-cache` run would read as a cold cache rather
 * than a disabled one.
 */
export function runReportLines(
  run: ReviewAllResult,
  { cached }: { cached: boolean },
): ReportLine[] {
  return [
    ...(run.stoppedEarly
      ? [
          {
            channel: "content" as const,
            entries: [
              "",
              {
                badge: "STOPPED",
                color: "yellow" as const,
                value: "Review stopped early due to --fail-fast",
              },
            ],
          },
        ]
      : []),
    { channel: "content", entries: summaryEntries(run.summary) },
    ...(cached
      ? [
          {
            channel: "content" as const,
            entries: [
              "",
              {
                badge: "CACHE",
                color: "blue" as const,
                value: `Hits: ${run.cacheStats.hits}, Misses: ${run.cacheStats.misses}`,
              },
            ],
          },
        ]
      : []),
  ];
}

/** Every reviewer's report on one target, each named when several ran. */
export function verdictReportsLines(
  reports: { reviewer: string; report: VerdictReport }[],
  { named, verbose }: { named: boolean; verbose: boolean },
): ReportLine[] {
  return reports.flatMap(({ reviewer, report }) => [
    ...(named
      ? [
          {
            channel: "content" as const,
            entries: ["", { text: `Reviewer: ${reviewer}`, color: "cyan" as const }],
          },
        ]
      : []),
    { channel: "content" as const, entries: verdictReportEntries(report, verbose) },
  ]);
}

/** One reviewed target's verdict line, labeled with its reviewer when several ran. */
export function reviewedTargetEntries({
  path,
  verdict,
  reviewerName,
  verbose,
}: {
  path: string;
  verdict: Verdict;
  reviewerName?: string;
  verbose: boolean;
}): DisplayEntry[] {
  const label = reviewerName ? `${path} ${chalk.cyan(`[reviewer: ${reviewerName}]`)}` : path;

  return verdictEntries(label, verdict, verbose);
}
