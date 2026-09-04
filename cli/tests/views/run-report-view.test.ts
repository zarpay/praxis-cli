import type { EvalSummary } from "@/types.js";

import { describe, expect, it } from "vitest";

import runReportView from "@/views/run-report-view.js";
import { reportText } from "@tests/helpers/report-text.js";

/** A finished run over the given summary, everything else quiet. */
function finished(summary: Partial<EvalSummary>) {
  return {
    cached: false,
    run: {
      verdicts: [],
      cacheStats: { hits: 0, misses: 0 },
      stoppedEarly: false,
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

    expect(text).toContain("[Compliant] 3");
    expect(text).toContain("[Errors] 2");
  });

  it("surfaces unverified units when any exist — they are not violations", () => {
    const text = reportText(runReportView(finished({ unverified: 2 })));

    expect(text).toContain("[Unverified] 2 (could not be reviewed)");
  });

  it("stays silent about unverified when everything was reviewable", () => {
    const text = reportText(runReportView(finished({})));

    expect(text).not.toContain("Unverified");
  });
});
