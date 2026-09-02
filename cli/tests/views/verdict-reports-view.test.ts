import type { CacheFileData, VerdictReport } from "@/types.js";

import { describe, expect, it } from "vitest";

import verdictReportsView from "@/views/verdict-reports-view.js";
import { reportText } from "@tests/helpers/report-text.js";

/** A report in a given state, with only the fields the view reads. */
function report(overrides: Partial<VerdictReport> = {}): VerdictReport {
  return {
    targetPath: "/project/docs/guide.md",
    status: "not_validated",
    cacheData: null,
    currentHash: null,
    isStale: false,
    ...overrides,
  };
}

/** Cached data for a report, with only the fields the view reads. */
function cacheData(overrides: Partial<CacheFileData> = {}): CacheFileData {
  return {
    version: "4.0",
    cached_at: "2026-08-31T12:00:00Z",
    content_hash: "abcd1234",
    document: { path: "/project/docs/guide.md", spec_path: "docs/README.md" },
    result: { compliant: true, issues: [], reason: "All good" },
    ...overrides,
  };
}

/** The rendered report as one searchable string. */
function rendered(subject: VerdictReport, verbose = false): string {
  return reportText(
    verdictReportsView({
      reports: [{ reviewer: "flash", report: subject }],
      named: false,
      verbose,
    }),
  );
}

describe("verdictReportsView", () => {
  it("shows the not-validated state", () => {
    expect(rendered(report())).toContain("NOT VALIDATED");
  });

  it("names the eval command in the guidance, not the removed v1 verb", () => {
    expect(rendered(report())).toContain("praxis eval run");
  });

  it("shows a pass with its spec", () => {
    const out = rendered(report({ status: "pass", cacheData: cacheData() }));

    expect(out).toContain("Document is compliant");
    expect(out).toContain("docs/README.md");
  });

  it("lists a failure's issues", () => {
    const failed = cacheData({
      result: {
        compliant: false,
        issues: [
          { text: "Missing owner field", axiomId: null, axiomVersion: null },
          { text: "Missing Objective section", axiomId: null, axiomVersion: null },
        ],
        reason: "Nope",
        severity: "error",
      },
    });

    const out = rendered(report({ status: "fail", cacheData: failed }));

    expect(out).toContain("Missing owner field");
    expect(out).toContain("Missing Objective section");
  });

  it("leads a stale report with the warning and what to do", () => {
    const out = rendered(report({ status: "stale", cacheData: cacheData(), isStale: true }));

    expect(out).toContain("Document has changed since last validation");
    expect(out).toContain("praxis eval run");
  });

  it("shows the reasoning only when verbose", () => {
    const subject = report({ status: "pass", cacheData: cacheData() });

    expect(rendered(subject, true)).toContain("AI Reasoning:");
    expect(rendered(subject, false)).not.toContain("AI Reasoning:");
  });
});

describe("naming reviewers", () => {
  it("frames each report with its reviewer when several could disagree", () => {
    const text = reportText(
      verdictReportsView({
        reports: [
          { reviewer: "flash", report: report() },
          { reviewer: "strict", report: report() },
        ],
        named: true,
        verbose: false,
      }),
    );

    expect(text).toContain("Reviewer: flash");
    expect(text).toContain("Reviewer: strict");
  });

  it("names nobody when only one reviewer ran", () => {
    const text = rendered(report());

    expect(text).not.toContain("Reviewer:");
  });
});
