import type { DebtReport } from "@/types.js";

import { describe, expect, it } from "vitest";

import { CALIBRATION_STATUS } from "@/helpers/metrics-helper.js";
import debtReportView from "@/views/debt-report-view.js";
import { reportText } from "@tests/helpers/report-text.js";

/** A one-row report; tests override per case. */
function report(overrides: Partial<DebtReport> = {}): DebtReport {
  return {
    evidence: [],
    calibration: CALIBRATION_STATUS,
    rows: [
      {
        axiomId: "AX-aaaa11",
        statement: "S.",
        reviewerName: "flash",
        baselineStock: 3,
        currentStock: 2,
        paydown: 1,
        appearedSinceBaseline: 0,
      },
    ],
    concentration: [{ directory: "src/services", violations: 2 }],
    credits: [{ author: "Fixer", resolved: 1 }],
    creditNote: null,
    rebaseline: null,
    ...overrides,
  };
}

describe("debtReportView", () => {
  it("is honestly named and carries the calibration banner", () => {
    const text = reportText(debtReportView(report()));

    expect(text).toContain("pre-spec debt included");
    expect(text).toContain("uncalibrated");
  });

  it("renders stock movement, concentration, and credit", () => {
    const text = reportText(debtReportView(report()));

    expect(text).toContain("baseline 3 → current 2");
    expect(text).toContain("src/services: 2");
    expect(text).toContain("Fixer: 1 resolved");
  });

  it("explains missing credit rather than guessing", () => {
    const withNote = report({ credits: [], creditNote: "paydown credit unavailable: x" });

    const text = reportText(debtReportView(withNote));

    expect(text).toContain("paydown credit unavailable");
  });

  it("points at a full run when no epoch is baselined yet", () => {
    const text = reportText(debtReportView(report({ rows: [] })));

    expect(text).toContain("praxis eval run");
  });
});
