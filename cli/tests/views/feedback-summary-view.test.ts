import { describe, expect, it } from "vitest";

import feedbackSummaryView from "@/views/feedback-summary-view.js";
import { reportText } from "@tests/helpers/report-text.js";

/** The summary as plain text. */
function rendered(usage: { costUsd: number | null } | null, elapsedMs: number): string {
  const full = usage === null ? null : { promptTokens: 1, completionTokens: 2, ...usage };

  return reportText(feedbackSummaryView({ usage: full, elapsedMs }));
}

describe("feedbackSummaryView", () => {
  it("reports the time and the cost when a reviewer was called", () => {
    const text = rendered({ costUsd: 0.0010863424 }, 80_000);

    expect(text).toContain("Time: 1m 20s");
    expect(text).toContain("Cost: $0.0011");
  });

  it("says the answer came from cache rather than claiming it was free", () => {
    const text = rendered(null, 400);

    expect(text).toContain("Time: 0s");
    expect(text).toContain("from cache");
    expect(text).not.toContain("$");
  });

  it("does not invent a cost when the backend reported none", () => {
    const text = rendered({ costUsd: null }, 2_000);

    expect(text).toContain("Time: 2s");
    expect(text).not.toContain("$");
  });
});
