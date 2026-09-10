import { describe, expect, it } from "vitest";

import labelReportView from "@/views/label-report-view.js";
import { reportText } from "@tests/helpers/report-text.js";

/** One labeling pass's summary, overridable per case. */
function report(overrides: Record<string, unknown> = {}) {
  return {
    labels: [
      { critiqueId: "r1:1", axiomId: "AX-aaaa11" },
      { critiqueId: "r1:2", axiomId: "AX-aaaa11" },
      { critiqueId: "r1:3", axiomId: "AX-bbbb22" },
    ],
    labeledByAxiom: [
      { axiomId: "AX-aaaa11", count: 2 },
      { axiomId: "AX-bbbb22", count: 1 },
    ],
    sentToCurate: 2,
    skippedNoAxioms: 0,
    failed: 0,
    usage: { promptTokens: 10, completionTokens: 5, costUsd: 0.1234 },
    sessionPath: ".praxis/ledger/triage/s1.jsonl",
    dryRun: false,
    ...overrides,
  };
}

describe("labelReportView", () => {
  it("counts the pass and tallies labels per axiom", () => {
    const text = reportText(labelReportView(report()));

    expect(text).toContain("Triage — the labeling pass");
    expect(text).toContain("Labeled:");
    expect(text).toContain("Sent to curate:");
    expect(text).toContain("AX-aaaa11  2 critique(s)");
    expect(text).toContain("AX-bbbb22  1 critique(s)");
    expect(text).toContain("Curator cost: $0.1234");
    expect(text).toContain("Next: `praxis axioms curate`");
  });

  it("announces a dry run as written-nothing", () => {
    const text = reportText(labelReportView(report({ dryRun: true })));

    expect(text).toContain("Dry run — nothing was written");
  });

  it("names failed calls and their retry path", () => {
    const text = reportText(labelReportView(report({ failed: 2 })));

    expect(text).toContain("Failed:");
    expect(text).toContain("2 labeling call(s) failed");
    expect(text).toContain("rerun triage to retry");
  });

  it("omits the curate hint when nothing awaits curation", () => {
    const text = reportText(labelReportView(report({ sentToCurate: 0 })));

    expect(text).not.toContain("praxis axioms curate");
  });
});
