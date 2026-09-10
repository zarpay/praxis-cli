import type { AxiomReport } from "@/types.js";

import { describe, expect, it } from "vitest";

import axiomReportView from "@/views/axiom-report-view.js";
import { reportText } from "@tests/helpers/report-text.js";

/** One category's report, with a single reviewer row and one example. */
function report(overrides: Partial<AxiomReport> = {}): AxiomReport {
  return {
    axiomId: "AX-3f9c2d",
    calibration: "uncalibrated",
    statement: "Error messages written for the implementer, not the API consumer.",
    status: "active",
    severity: null,
    derivedFrom: "src/services/README.md#behavior",
    introduced: "2026-09-02",
    version: 2,
    rows: [
      {
        reviewerName: "flash",
        rate: { display: "1/5 (20.0%)", suppressed: false },
        asOf: "2026-09-08T10:00:00.000Z",
        files: 1,
        byPopulation: { pre_spec: 1, post_spec: 2, unknown: 0 },
        epochs: [],
      },
    ],
    examples: [
      {
        id: "r1:1",
        filePath: "src/services/redeem-coupon.ts",
        reviewerName: "flash",
        text: "Error message 'bad input' tells the consumer nothing.",
      },
    ],
    ...overrides,
  } as AxiomReport;
}

describe("axiomReportView", () => {
  it("shows identity, provenance, the rate row, and representative critiques", () => {
    const text = reportText(axiomReportView(report()));

    expect(text).toContain("AX-3f9c2d v2");
    expect(text).toContain("● active");
    expect(text).toContain("derives from");
    expect(text).toContain("src/services/README.md#behavior");
    expect(text).toContain("flash");
    expect(text).toContain("1/5 (20.0%)");
    expect(text).toContain("Representative critiques");
    expect(text).toContain("src/services/redeem-coupon.ts");
  });

  it("omits the severity slot when the category carries none", () => {
    const text = reportText(axiomReportView(report({ severity: null })));

    expect(text).not.toContain("(null)");
    expect(text).not.toContain("severity");
  });

  it("marks a historical severity as historical in the heading", () => {
    const text = reportText(axiomReportView(report({ severity: "warning" })));

    expect(text).toContain("severity warning (historical)");
  });

  it("renders the machine payload under --json", () => {
    const lines = axiomReportView({ ...report(), json: true });
    const parsed = JSON.parse(reportText(lines)) as Record<string, unknown>;

    expect(parsed["axiomId"]).toBe("AX-3f9c2d");
    expect(parsed["json"]).toBeUndefined();
  });
});
