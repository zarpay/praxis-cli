import type { EvalCoverage, EvalSummary, ReviewAllResult } from "@/types.js";
import type { DisplayEntry, View } from "@framework/types.js";

import { badge, verdictTally } from "@framework/views/badges.js";
import { duration } from "@framework/views/duration.js";
import { palette } from "@framework/views/palette.js";
import { percent } from "@framework/views/stats.js";
import { table } from "@framework/views/table.js";

/** A completed full run, ready to report. */
interface FinishedRun {
  run: ReviewAllResult;
  /** Whether the cache was consulted — a disabled cache is not a cold one. */
  cached: boolean;
  /** Wall-clock the run took, for the spend line. */
  elapsedMs: number;
  /** Spec coverage over the source corpus (07: renders with conformance, always). */
  coverage: EvalCoverage;
}

/**
 * What a finished run reports: the fail-fast notice if it stopped early,
 * the summary block, and the cache tally.
 *
 * The cache line appears only when the cache was consulted — reporting
 * "Hits: 0" for a `--no-cache` run would read as a cold cache rather
 * than a disabled one.
 *
 * The spend line always shows the time and shows the cost only when a
 * reviewer was actually called: a run answered entirely from cache spent
 * nothing, and "$0.0000" would claim a measurement never taken.
 */
const runReportView: View<FinishedRun> = ({ run, cached, elapsedMs, coverage }) => [
  ...(run.stoppedEarly
    ? [content(badge("STOPPED", "yellow", "Review stopped early due to --fail-fast"))]
    : []),
  { channel: "content", entries: summary(run.summary, coverage) },
  ...(cached
    ? [
        content(
          badge("CACHE", "blue", `Hits: ${run.cacheStats.hits}, Misses: ${run.cacheStats.misses}`),
        ),
      ]
    : []),
  content(badge("SPEND", "blue", spend(run, cached, elapsedMs))),
];

export default runReportView;

/**
 * Wall-clock always; cost only when something was paid for.
 *
 * A run with no cost says why, rather than going quiet — silence reads
 * as a missing number, and "free because every verdict was cached" is a
 * different fact from "we did not measure it".
 */
function spend(run: ReviewAllResult, cached: boolean, elapsedMs: number): string {
  const time = `Time: ${duration(elapsedMs)}`;
  const cost = run.usage?.costUsd;

  if (cost !== null && cost !== undefined) return `${time}, Cost: $${cost.toFixed(4)}`;

  // Unverified units called a reviewer and failed, and a failed call is
  // neither a hit nor a miss — so "no misses" alone does not mean
  // nothing was attempted, and claiming the time was free would be a lie
  // about a run that just spent ninety seconds.
  const nothingAttempted = run.cacheStats.misses === 0 && run.summary.unverified === 0;

  if (cached && nothingAttempted) return `${time} (from cache)`;

  return time;
}

/** One badge on its own content line, padded from what came before. */
function content(badge: DisplayEntry): { channel: "content"; entries: DisplayEntry[] } {
  return { channel: "content", entries: ["", badge] };
}

/**
 * A run that found nothing to review is a setup gap, not a clean bill:
 * the notice says why it happens and what creates the first review
 * unit (09: errors instruct).
 */
const emptyCorpusNotice: DisplayEntry[] = [
  "",
  { header: "Summary — corpus conformance (includes pre-spec debt)" },
  "Total documents: 0 — no spec governs any files yet.",
  "",
  "A full run reviews the files that specs govern, and specs are",
  "discovered in the directories `sources` lists in .praxis/config.json.",
  "To get a first review unit:",
  "  1. Write a spec: a README.md next to the code it governs, stating",
  "     what correct looks like (paths: frontmatter widens its scope;",
  "     without it the spec governs its own directory's files)",
  '  2. Point sources at that directory: "sources": ["src"]',
  "  3. Run `praxis eval run` again — or `praxis eval run <file>` to",
  "     review one file without touching sources",
];

/**
 * The aggregated summary block.
 *
 * Reviewers are separate instruments, so their series render separately
 * and are never pooled into one number (07 rule 7). With one reviewer
 * the one-line tally is exact — verdicts and documents coincide — so it
 * stays. With several, pooling their verdicts into one line would print
 * "40 pass" against 31 documents, so the tally becomes the per-reviewer
 * table and the document-counted facts get their own labeled lines,
 * each wearing its denominator.
 */
function summary(totals: EvalSummary, coverage: EvalCoverage): DisplayEntry[] {
  if (totals.total === 0) return emptyCorpusNotice;

  const reviewerNames = Object.keys(totals.byReviewer);
  const multiReviewer = reviewerNames.length > 1;
  const verdictLines = multiReviewer ? reviewerTable(totals, reviewerNames) : pooledTally(totals);

  // The by-type cells count verdicts; with several reviewers each
  // document contributes one per reviewer, and the label says so
  // rather than letting the counts read as documents.
  const byTypeLabel = multiReviewer
    ? `By type (verdicts from ${reviewerNames.length} reviewers):`
    : "By type:";

  const verdictLabel = multiReviewer ? "By reviewer:" : "Verdicts:";

  return [
    "",
    { header: "Summary — corpus conformance (includes pre-spec debt)" },
    `Total documents: ${totals.total}`,
    "",
    "Coverage:",
    ...coverageTable(coverage),
    "",
    verdictLabel,
    ...verdictLines,
    "",
    byTypeLabel,
    ...table(
      Object.entries(totals.byType).map(([type, stats]) => [
        type,
        `${stats.compliant}/${stats.total} compliant`,
      ]),
      ["TYPE", "COMPLIANT"],
    ),
  ];
}

/**
 * The coverage slices as rows over one denominator, the corpus:
 * governed, clearing, and no spec at all. Observed and Not observed
 * partition the corpus; Passing is the subset of Observed that clears.
 */
function coverageTable(coverage: EvalCoverage): string[] {
  const unobserved = coverage.sourceFiles - coverage.observed.files;
  const unobservedRate = coverage.sourceFiles === 0 ? null : unobserved / coverage.sourceFiles;

  const rows = [
    [
      "Observed",
      `${coverage.observed.files}/${coverage.sourceFiles}`,
      percent(coverage.observed.rate),
    ],
    [
      "Passing",
      `${coverage.passing.files}/${coverage.sourceFiles}`,
      percent(coverage.passing.rate),
    ],
    ["Not observed", `${unobserved}/${coverage.sourceFiles}`, percent(unobservedRate)],
  ];

  return table(rows, ["COVERAGE", "FILES", "RATE"]);
}

/** The single-reviewer tally: one line, verdicts and documents coincide. */
function pooledTally(totals: EvalSummary): DisplayEntry[] {
  // Not-validated lives in the coverage table, never repeated here.
  const tally = verdictTally({
    pass: totals.compliant,
    warn: totals.warnings,
    fail: totals.errors,
  });

  return [
    `  ${tally}`,
    totals.unverified > 0 &&
      `  ${palette.warn(`● ${totals.unverified} unverified`)} ${palette.meta("(could not be reviewed — the run fails)")}`,
  ];
}

/** The multi-reviewer tally: verdict counts per reviewer, document counts labeled. */
function reviewerTable(totals: EvalSummary, reviewerNames: string[]): DisplayEntry[] {
  const rows = reviewerNames.map((name) => {
    const stats = totals.byReviewer[name];

    return [name, stats?.compliant ?? 0, stats?.warnings ?? 0, stats?.errors ?? 0];
  });

  return [
    ...table(rows, ["REVIEWER", "PASS", "WARN", "FAIL"]),
    totals.unverified > 0 &&
      `${palette.warn(`Unverified: ${totals.unverified} verdict(s)`)} ${palette.meta("(could not be reviewed — the run fails)")}`,
  ];
}
