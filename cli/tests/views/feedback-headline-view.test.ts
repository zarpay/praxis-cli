import { describe, expect, it } from "vitest";

import feedbackHeadlineView from "@/views/feedback-headline-view.js";
import { reportText } from "@tests/helpers/report-text.js";

/** The headline as plain lines. */
function rendered(target: string, units: string[]): string {
  return reportText(feedbackHeadlineView({ target, units }));
}

describe("feedbackHeadlineView", () => {
  it("names the target and says the run is never queued", () => {
    const text = rendered("src/services/checkout.ts", ["src/services/checkout.ts"]);

    expect(text).toContain("Feedback on src/services/checkout.ts");
    expect(text).toContain("never queued for triage");
  });

  it("stays quiet about coverage when the unit is what was typed", () => {
    const text = rendered("src/services/checkout.ts", ["src/services/checkout.ts"]);

    expect(text).not.toContain("covering:");
  });

  it("names the units when they are not what was typed", () => {
    const text = rendered("src/features/loyalty/award.ts", [
      "src/features/loyalty (cohort · 2 files)",
    ]);

    expect(text).toContain("covering:");
    expect(text).toContain("src/features/loyalty (cohort · 2 files)");
  });

  it("lists every unit a directory resolved to", () => {
    const text = rendered("src/services", ["src/services/a.ts", "src/services/b.ts"]);

    expect(text).toContain("src/services/a.ts");
    expect(text).toContain("src/services/b.ts");
  });
});
