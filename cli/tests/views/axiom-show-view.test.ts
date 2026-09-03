import { describe, expect, it } from "vitest";

import { AxiomFile } from "@/models/axiom-file.js";
import axiomShowView from "@/views/axiom-show-view.js";
import { reportText } from "@tests/helpers/report-text.js";

/** A ratified axiom with both examples. */
function axiom(): AxiomFile {
  const content = [
    "---",
    "id: AX-3f9c2d",
    "version: 2",
    "status: active",
    "severity: warning",
    "grounded_in: src/services/README.md#behavior",
    "introduced: 2026-08-29",
    "---",
    "",
    "Error messages name what would be accepted instead.",
    "",
    "## Violating example",
    "",
    "bad subject",
    "",
    "## Compliant example",
    "",
    "subject must be a non-empty string",
  ].join("\n");

  return AxiomFile.fromContent(content, "AX-3f9c2d.md");
}

describe("axiomShowView", () => {
  it("shows identity, lifecycle, grounding, and the full body", () => {
    const text = reportText(axiomShowView({ axiom: axiom() }));

    expect(text).toContain("AX-3f9c2d v2 — active");
    expect(text).toContain("grounded in: src/services/README.md#behavior");
    expect(text).toContain("## Violating example");
    expect(text).toContain("## Compliant example");
  });

  it("marks an unratified proposal's missing grounding", () => {
    const proposal = AxiomFile.fromContent(
      [
        "---",
        "id: AX-aaaa11",
        "version: 1",
        "status: proposed",
        "severity: error",
        "introduced: 2026-09-02",
        "---",
        "",
        "S.",
      ].join("\n"),
      "AX-aaaa11.md",
    );

    const text = reportText(axiomShowView({ axiom: proposal }));

    expect(text).toContain("not ratified yet");
  });

  it("renders the stable JSON contract when asked", () => {
    const lines = axiomShowView({ axiom: axiom(), json: true });
    const parsed = JSON.parse(reportText(lines)) as Record<string, unknown>;

    expect(parsed).toMatchObject({
      id: "AX-3f9c2d",
      version: 2,
      grounded_in: "src/services/README.md#behavior",
    });
    expect(parsed["body"]).toContain("## Compliant example");
  });
});
