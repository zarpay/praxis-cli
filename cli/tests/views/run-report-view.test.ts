import type { EvalSummary } from "@/types.js";

import { describe, expect, it } from "vitest";

import runReportView from "@/views/run-report-view.js";
import { reportText } from "@tests/helpers/report-text.js";

/** A finished run over the given summary, everything else quiet. */
function finished(summary: Partial<EvalSummary>) {
  return {
    cached: false,
    elapsedMs: 1_000,
    coverage: {
      sourceFiles: 5,
      observed: { files: 4, rate: 0.8, display: "80% (4/5 files)" },
      passing: { files: 3, rate: 0.6, display: "60% (3/5 files)" },
    },
    run: {
      verdicts: [],
      cacheStats: { hits: 0, misses: 0 },
      stoppedEarly: false,
      usage: null,
      summary: {
        total: 5,
        compliant: 5,
        warnings: 0,
        errors: 0,
        unverified: 0,
        notValidated: 0,
        byType: {},
        byReviewer: {},
        ...summary,
      },
    },
  };
}

describe("runReportView", () => {
  it("shows the verdict tallies", () => {
    const text = reportText(runReportView(finished({ compliant: 3, errors: 2 })));

    expect(text).toContain("3 pass");
    expect(text).toContain("2 fail");
  });

  it("never pools reviewers: two reviewers render as table rows, not one tally", () => {
    const text = reportText(
      runReportView(
        finished({
          total: 31,
          compliant: 40,
          errors: 6,
          notValidated: 8,
          byReviewer: {
            mercury: { compliant: 17, warnings: 0, errors: 6 },
            counter: { compliant: 23, warnings: 0, errors: 0 },
          },
        }),
      ),
    );

    expect(text).not.toContain("40 pass");
    expect(text).toContain("By reviewer:");
    expect(text).toMatch(/mercury\s*│\s*17\s*│\s*0\s*│\s*6/);
    expect(text).toMatch(/counter\s*│\s*23\s*│\s*0\s*│\s*0/);
    expect(text).toMatch(/Not validated\s*│\s*8\/31\s*│\s*26%/);
    expect(text).toContain("By type (verdicts from 2 reviewers):");
  });

  it("labels unverified as verdict counts when reviewers render separately", () => {
    const text = reportText(
      runReportView(
        finished({
          unverified: 2,
          byReviewer: {
            mercury: { compliant: 1, warnings: 0, errors: 0 },
            counter: { compliant: 1, warnings: 0, errors: 0 },
          },
        }),
      ),
    );

    expect(text).toContain("Unverified: 2 verdict(s)");
  });

  it("renders coverage as a labeled table beside the conformance tally (07: they render together)", () => {
    const text = reportText(runReportView(finished({ notValidated: 1 })));

    expect(text).toContain("Coverage:");
    expect(text).toMatch(/COVERAGE\s*│\s*FILES\s*│\s*RATE/);
    expect(text).toMatch(/Observed\s*│\s*4\/5\s*│\s*80%/);
    expect(text).toMatch(/Passing\s*│\s*3\/5\s*│\s*60%/);
    expect(text).toMatch(/Not validated\s*│\s*1\/5\s*│\s*20%/);
  });

  it("labels the single-reviewer verdict tally, which no longer repeats not-validated", () => {
    const text = reportText(runReportView(finished({ notValidated: 1 })));

    expect(text).toContain("Verdicts:");
    expect(text).not.toContain("not validated");
  });

  it("surfaces unverified units when any exist — they are not violations", () => {
    const text = reportText(runReportView(finished({ unverified: 2 })));

    expect(text).toContain("2 unverified");
  });

  it("stays silent about unverified when everything was reviewable", () => {
    const text = reportText(runReportView(finished({})));

    expect(text).not.toContain("Unverified");
  });

  it("says a run cost nothing because it was cached, rather than going quiet", () => {
    const run = finished({});
    const cachedRun = {
      ...run,
      cached: true,
      elapsedMs: 3_000,
      run: { ...run.run, cacheStats: { hits: 9, misses: 0 } },
    };

    expect(reportText(runReportView(cachedRun))).toContain("Time: 3s (from cache)");
  });

  it("never claims a run was cached when a call was attempted and failed", () => {
    const run = finished({ unverified: 1 });
    // A failed call is neither a hit nor a miss, so "no misses" alone
    // does not mean nothing was attempted.
    const attempted = {
      ...run,
      cached: true,
      elapsedMs: 90_000,
      run: { ...run.run, cacheStats: { hits: 68, misses: 0 } },
    };

    expect(reportText(runReportView(attempted))).toContain("Time: 1m 30s");
    expect(reportText(runReportView(attempted))).not.toContain("from cache");
  });

  it("reports the cost when reviewers were actually called", () => {
    const run = finished({});
    const paidRun = {
      ...run,
      cached: true,
      elapsedMs: 80_000,
      run: {
        ...run.run,
        cacheStats: { hits: 0, misses: 2 },
        usage: { promptTokens: 1772, completionTokens: 5740, costUsd: 0.0010863424 },
      },
    };

    expect(reportText(runReportView(paidRun))).toContain("Time: 1m 20s, Cost: $0.0011");
  });

  it("instructs instead of tallying when the corpus is empty", () => {
    const text = reportText(runReportView(finished({ total: 0, compliant: 0 })));

    expect(text).toContain("no spec governs any files yet");
    expect(text).toContain('"sources": ["src"]');
    expect(text).not.toContain("0 pass");
  });
});
