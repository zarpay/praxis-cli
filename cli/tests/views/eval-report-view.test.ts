import type { EvalReport } from "@/types.js";

import { describe, expect, it } from "vitest";

import { rateCell } from "@/helpers/metrics-helper.js";
import evalReportView from "@/views/eval-report-view.js";
import { reportText } from "@tests/helpers/report-text.js";

/** A minimal report; tests override per case. */
function report(overrides: Partial<EvalReport> = {}): EvalReport {
  return {
    scope: { target: null, since: null, branch: null, commits: null, unresolvableShas: [] },
    panel: {
      runs: 2,
      critiques: 3,
      filesTouched: 2,
      reviewers: ["flash"],
      specs: ["docs/README.md"],
      costUsd: 0.01,
      costTrend: [],
    },
    calibration: "v32: uninterpretable — recalibrate",
    axioms: [],
    pendingTriage: 0,
    flow: null,
    residual: rateCell(1, 10),
    epochs: [],
    ...overrides,
  };
}

describe("evalReportView", () => {
  it("carries the calibration banner on every render (rule 4)", () => {
    const text = reportText(evalReportView(report()));

    expect(text).toContain("uninterpretable — recalibrate");
  });

  it("renders suppressed cells as insufficient data, never a number (rule 3)", () => {
    const row = {
      axiomId: "AX-aaaa11",
      statement: "S.",
      severity: "error" as const,
      reviewerName: "flash",
      asOf: "2026-09-03T10:00:00.000Z",
      rate: rateCell(1, 2),
      files: 1,
      byPopulation: { pre_spec: 0, post_spec: 0, unknown: 1 },
      segments: [],
    };

    const text = reportText(evalReportView(report({ axioms: [row] })));

    expect(text).toContain("insufficient data");
    expect(text).toContain("pre-spec 0");
  });

  it("renders the missing-commit note for an unresolvable sha (12)", () => {
    const scoped = report();
    scoped.scope.unresolvableShas = [
      { sha: "f".repeat(40), branch: "feature", at: "2026-09-01T10:00:00.000Z" },
    ];

    const text = reportText(evalReportView(scoped));

    expect(text).toContain("squash-merged or rebased");
    expect(text).toContain("The evidence still stands");
  });

  it("emits the payload verbatim as the json contract", () => {
    const lines = evalReportView({ ...report(), json: true });
    const parsed = JSON.parse(reportText(lines)) as EvalReport;

    expect(parsed.panel.runs).toBe(2);
    expect(parsed.calibration).toContain("uninterpretable — recalibrate");
  });
});
