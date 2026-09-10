import { describe, expect, it } from "vitest";

import { AxiomFile } from "@/models/axiom-file.js";
import axiomShowView from "@/views/axiom-show-view.js";
import { axiomContent } from "@tests/helpers/axiom-fixtures.js";
import { reportText } from "@tests/helpers/report-text.js";

/** An active category derived from a spec passage. */
function axiom(): AxiomFile {
  const content = axiomContent(
    {
      id: "AX-3f9c2d",
      version: "2",
      severity: null,
      derived_from: "src/services/README.md#behavior",
    },
    { body: "Error messages written for the implementer, not the API consumer." },
  );

  return AxiomFile.fromContent(content, "AX-3f9c2d.md");
}

/** One labeled critique, as the orchestrator hands it over. */
function critique() {
  return {
    id: "cr-0001",
    filePath: "src/services/redeem-coupon.ts",
    reviewerName: "flash",
    text: "Error message 'bad input' tells the consumer nothing.",
  };
}

describe("axiomShowView", () => {
  it("shows identity, provenance, and the statement", () => {
    const text = reportText(axiomShowView({ axiom: axiom(), critiques: [], labeledCount: 0 }));

    expect(text).toContain("AX-3f9c2d v2 — active");
    expect(text).toContain("derives from: src/services/README.md#behavior");
    expect(text).toContain("Error messages written for the implementer, not the API consumer.");
    expect(text).not.toContain("severity:");
  });

  it("shows the category's labeled critiques as its live examples", () => {
    const text = reportText(
      axiomShowView({ axiom: axiom(), critiques: [critique()], labeledCount: 7 }),
    );

    expect(text).toContain("Labeled critiques (7 total, showing 1):");
    expect(text).toContain("src/services/redeem-coupon.ts");
    expect(text).toContain("Error message 'bad input' tells the consumer nothing.");
    expect(text).toContain("praxis eval critiques --axiom AX-3f9c2d");
  });

  it("marks a historical severity as historical", () => {
    const content = axiomContent({ id: "AX-3f9c2d", severity: "warning" }, { body: "S." });
    const historical = AxiomFile.fromContent(content, "AX-3f9c2d.md");

    const text = reportText(axiomShowView({ axiom: historical, critiques: [], labeledCount: 0 }));

    expect(text).toContain("severity: warning (historical)");
  });

  it("renders the stable JSON contract when asked", () => {
    const lines = axiomShowView({
      axiom: axiom(),
      critiques: [critique()],
      labeledCount: 7,
      json: true,
    });
    const parsed = JSON.parse(reportText(lines)) as Record<string, unknown>;

    expect(parsed).toMatchObject({
      id: "AX-3f9c2d",
      version: 2,
      derived_from: "src/services/README.md#behavior",
      labeled_count: 7,
    });
    expect(parsed["representative_critiques"]).toHaveLength(1);
  });
});
