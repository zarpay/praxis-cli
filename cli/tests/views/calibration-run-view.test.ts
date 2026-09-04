import { describe, expect, it } from "vitest";

import calibrationRunView from "@/views/calibration-run-view.js";
import { calibrationRecord } from "@tests/helpers/calibration-cases.js";
import { reportText } from "@tests/helpers/report-text.js";

describe("calibrationRunView", () => {
  it("renders agreement with its denominator and per-axiom cells", () => {
    const record = calibrationRecord({
      case_count: 6,
      repeats: 1,
      verdict_matches: 5,
      axiom_scores: [
        {
          axiom_id: "AX-b951db",
          cases: 6,
          true_positives: 4,
          false_positives: 1,
          false_negatives: 1,
          variance: null,
        },
      ],
    });

    const text = reportText(calibrationRunView(record));

    expect(text).toContain("Calibration — v32 · 6 case(s) × 1");
    expect(text).toContain("verdict agreement: 5/6");
    expect(text).toContain("AX-b951db: precision 4/5");
    expect(text).toContain("recall 4/5");
    expect(text).toContain("FP 1");
  });

  it("floors thin data instead of printing a fake rate (07)", () => {
    const record = calibrationRecord({ case_count: 2, repeats: 1, verdict_matches: 2 });

    const text = reportText(calibrationRunView(record));

    expect(text).toContain("insufficient data (n<5)");
  });

  it("names drift-flagged axioms and unverified counts out loud", () => {
    const record = calibrationRecord({
      drift_flagged: ["AX-aaaaaa"],
      unverified_count: 1,
    });

    const text = reportText(calibrationRunView(record));

    expect(text).toContain("drift: AX-aaaaaa");
    expect(text).toContain("unverified: 1 (counted as disagreement)");
  });

  it("shows variance when repeats measured it", () => {
    const record = calibrationRecord({
      repeats: 3,
      axiom_scores: [
        {
          axiom_id: "AX-b951db",
          cases: 6,
          true_positives: 6,
          false_positives: 0,
          false_negatives: 0,
          variance: 0.25,
        },
      ],
    });

    const text = reportText(calibrationRunView(record));

    expect(text).toContain("variance 0.25");
  });
});
