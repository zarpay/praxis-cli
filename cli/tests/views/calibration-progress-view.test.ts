import type { CalibrationCaseOutcome } from "@/types.js";

import { describe, expect, it } from "vitest";

import calibrationProgressView from "@/views/calibration-progress-view.js";
import { reportText } from "@tests/helpers/report-text.js";

function outcome(overrides: Partial<CalibrationCaseOutcome> = {}): CalibrationCaseOutcome {
  return {
    caseId: "case-1",
    repeat: 1,
    expected: "fail",
    actual: "fail",
    matched: true,
    ...overrides,
  };
}

describe("calibrationProgressView", () => {
  it("a match shows the agreed verdict", () => {
    const text = reportText(calibrationProgressView(outcome()));

    expect(text).toContain("case-1 — fail");
  });

  it("a mismatch shows both sides", () => {
    const text = reportText(calibrationProgressView(outcome({ actual: "pass", matched: false })));

    expect(text).toContain("expected fail, got pass");
  });

  it("an unverified review says so", () => {
    const text = reportText(calibrationProgressView(outcome({ actual: null, matched: false })));

    expect(text).toContain("expected fail, got unverified");
  });

  it("repeats beyond the first are labeled", () => {
    const text = reportText(calibrationProgressView(outcome({ repeat: 2 })));

    expect(text).toContain("(repeat 2)");
  });
});
