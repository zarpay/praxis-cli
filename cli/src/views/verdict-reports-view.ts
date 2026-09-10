import type { CacheFileData, VerdictReportStatus, VerdictReport } from "@/types.js";
import type { DisplayEntry, View } from "@framework/types.js";

import { card } from "@framework/views/card.js";
import { palette } from "@framework/views/palette.js";

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
            entries: ["", palette.structure(`Reviewer: ${reviewer}`)],
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

  const attrs: [string, string][] = [
    ["document", report.targetPath],
    ...(cacheData
      ? ([
          ["spec", cacheData.document.spec_path],
          ["validated", formatDate(cacheData.cached_at)],
        ] as [string, string][])
      : []),
    ["status", statusLine(report.status)],
  ];

  const body: string[] = [];

  if (report.isStale && cacheData) {
    body.push(
      palette.warn("! Document has changed since last validation"),
      palette.warn("  Run `praxis eval run <target>` to re-validate"),
      "",
      `${palette.meta("last result")}  ${lastResultLine(cacheData.result)}`,
    );
  }

  if (showIssues) {
    if (body.length > 0) body.push("");

    body.push("Issues:");
    body.push(...issues.map((issue) => `  - ${issueLabel(issue)}${issue.text}`));
  }

  if (report.status === "not_validated") {
    if (body.length > 0) body.push("");

    body.push(`Run ${palette.ref("`praxis eval run " + report.targetPath + "`")} to validate.`);
  }

  if (verbose && cacheData) {
    if (body.length > 0) body.push("");

    body.push(palette.structure("AI reasoning"));
    body.push(...cacheData.result.reason.split("\n").map((line) => palette.quote(line)));
  }

  return ["", ...card({ title: "validation report", attrs, body })];
}

/** The status attribute: a colored dot with the one-line meaning. */
function statusLine(status: VerdictReportStatus): string {
  switch (status) {
    case "pass":
      return `${palette.good("● PASS")} — document is compliant`;
    case "warn":
      return `${palette.warn("● WARN")} — document has warnings`;
    case "fail":
      return `${palette.bad("● FAIL")} — document has errors`;
    case "stale":
      return `${palette.warn("● STALE")} — cached result is outdated`;
    case "not_validated":
      return `${palette.meta("● NOT VALIDATED")} — no cached result found`;
  }
}

/** The stale block's summary of the outdated verdict: its mark and issue count. */
function lastResultLine(result: CacheFileData["result"]): string {
  const count = result.issues.length;
  const noun = count === 1 ? "issue" : "issues";
  const value = count > 0 ? `${count} ${noun}` : "no issues";

  if (result.compliant) return `${palette.good("● PASS")} ${value}`;

  if (result.severity === "warning") return `${palette.warn("● WARN")} ${value}`;

  return `${palette.bad("● FAIL")} ${value}`;
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
  return issue.axiomId === null ? "" : palette.ref(`[${issue.axiomId}] `);
}
