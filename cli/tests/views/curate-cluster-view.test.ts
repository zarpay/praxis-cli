import type { PendingCritique, TriageCluster } from "@/types.js";

import { describe, expect, it } from "vitest";

import curateClusterView from "@/views/curate-cluster-view.js";
import { printableWidth } from "@framework/views/palette.js";
import { reportText } from "@tests/helpers/report-text.js";

/** One pending critique, with only the fields the card shows. */
function critique(overrides: Partial<PendingCritique> = {}): PendingCritique {
  return {
    id: "r1:1",
    runId: "r1",
    filePath: "src/services/rank-parlors.ts",
    specPath: "src/services/README.md",
    reviewerName: "flash",
    severity: "warning",
    text: "The happy path begins before the parlor id is validated.",
    ...overrides,
  };
}

/** A cluster proposing a new category, the common curate shape. */
function cluster(overrides: Partial<TriageCluster> = {}): TriageCluster {
  return {
    critiqueIds: ["r1:1"],
    rationale: "Both are consumer-hostile error messages.",
    suggestion: {
      kind: "propose",
      draft: { statement: "Error messages name what would be accepted.", groundingHint: "" },
    },
    ...overrides,
  };
}

/** Every rendered line of the cluster card. */
function lines(data: Parameters<typeof curateClusterView>[0]): string[] {
  return reportText(curateClusterView(data)).split("\n");
}

describe("curateClusterView", () => {
  it("keeps the card within the terminal when a critique runs long", () => {
    const long =
      "The happy path begins before the parlor id is validated, so a malformed request " +
      "reaches the ranking logic before anything rejects it, and the failure surfaces " +
      "far from its cause with no indication of what the caller got wrong.";
    const rendered = lines({
      index: 1,
      total: 2,
      cluster: cluster(),
      critiques: [{ ...critique({ text: long }), copies: 1 }],
    });
    const widths = new Set(rendered.filter(Boolean).map((line) => printableWidth(line)));

    expect(widths.size).toBe(1);
    expect([...widths][0]).toBeLessThanOrEqual(80);
  });

  it("keeps the card within the terminal when a path runs long", () => {
    const deep = `src/features/${"nested/".repeat(12)}rank-parlors.ts`;
    const rendered = lines({
      index: 1,
      total: 1,
      cluster: cluster(),
      critiques: [{ ...critique({ filePath: deep }), copies: 3 }],
    });
    const widths = new Set(rendered.filter(Boolean).map((line) => printableWidth(line)));

    expect(widths.size).toBe(1);
    expect([...widths][0]).toBeLessThanOrEqual(80);
  });

  it("shows the rationale, the critique, and the suggestion", () => {
    const rendered = lines({
      index: 1,
      total: 2,
      cluster: cluster(),
      critiques: [{ ...critique(), copies: 1 }],
    }).join("\n");

    expect(rendered).toContain("cluster 1/2");
    expect(rendered).toContain("consumer-hostile error messages");
    expect(rendered).toContain("Error messages name what would be accepted.");
  });
});
