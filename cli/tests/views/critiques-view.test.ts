import { describe, expect, it } from "vitest";

import critiquesView from "@/views/critiques-view.js";
import { reportText } from "@tests/helpers/report-text.js";

/** One critique card as the listing receives it. */
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "r1:1",
    runId: "r1",
    timestamp: "2026-09-02T21:21:25.548Z",
    filePath: "src/services/redeem-coupon.ts",
    reviewerName: "flash",
    severity: "error",
    text: "Error message 'bad input' tells the consumer nothing.",
    state: "labeled" as const,
    axiomId: "AX-b951db",
    ...overrides,
  };
}

/** Zeroed tallies, overridden per case. */
function totals(overrides: Record<string, number> = {}) {
  return { untriaged: 0, unmatched: 0, labeled: 0, dismissed: 0, ...overrides };
}

describe("critiquesView", () => {
  it("shows each card's identity, provenance, words, and standing", () => {
    const data = { rows: [row()], totals: totals({ labeled: 1 }) };

    const text = reportText(critiquesView(data));

    expect(text).toContain("Critiques — 1 in scope");
    expect(text).toContain("r1:1");
    expect(text).toContain("src/services/redeem-coupon.ts");
    expect(text).toContain("flash · error");
    expect(text).toContain("Error message 'bad input' tells the consumer nothing.");
    expect(text).toContain("AX-b951db");
  });

  it("names each lifecycle state in the standing line", () => {
    const rows = [
      row({ id: "r1:1", state: "untriaged", axiomId: null }),
      row({ id: "r1:2", state: "unmatched", axiomId: null }),
      row({ id: "r1:3", state: "dismissed", axiomId: null }),
    ];

    const text = reportText(critiquesView({ rows, totals: totals() }));

    expect(text).toContain("untriaged — awaiting triage");
    expect(text).toContain("unmatched — awaiting curation");
    expect(text).toContain("dismissed");
  });

  it("says so when nothing matches the filters", () => {
    const text = reportText(critiquesView({ rows: [], totals: totals({ labeled: 3 }) }));

    expect(text).toContain("none in scope");
    expect(text).toContain("labeled 3");
    expect(text).toContain("Nothing matches the filters.");
  });

  it("renders the machine payload under --json", () => {
    const lines = critiquesView({ rows: [row()], totals: totals({ labeled: 1 }), json: true });
    const parsed = JSON.parse(reportText(lines)) as { totals: unknown; critiques: unknown[] };

    expect(parsed.critiques).toHaveLength(1);
    expect(parsed.totals).toEqual(totals({ labeled: 1 }));
  });
});
