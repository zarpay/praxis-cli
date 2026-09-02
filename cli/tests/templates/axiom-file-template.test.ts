import { describe, expect, it } from "vitest";

import { AxiomFile } from "@/models/axiom-file.js";
import axiomFileTemplate from "@/templates/axiom-file-template.js";

/** The vars a triage-accepted draft supplies. */
function vars() {
  return {
    id: "AX-3f9c2d",
    status: "proposed" as const,
    mode: "judgment" as const,
    scope: "file" as const,
    severity: "warning" as const,
    introduced: "2026-09-02",
    groundedIn: null,
    statement: "Error messages name what would be accepted instead.",
    violatingExample: '`throw new Error("bad subject")`',
    compliantExample: '`{ ok: false, error: "subject must be a non-empty string" }`',
  };
}

describe("axiomFileTemplate", () => {
  it("renders a document the AxiomFile model accepts", () => {
    const document = axiomFileTemplate(vars());

    const axiom = AxiomFile.fromContent(document, "AX-3f9c2d.md");

    expect(axiom.id).toBe("AX-3f9c2d");
    expect(axiom.status).toBe("proposed");
    expect(axiom.version).toBe(1);
    expect(axiom.groundedIn).toBeNull();
    expect(axiom.statement()).toBe("Error messages name what would be accepted instead.");
  });

  it("keeps grounded_in absent until ratification establishes it", () => {
    const document = axiomFileTemplate(vars());

    expect(document).not.toContain("grounded_in");
  });

  it("writes grounded_in when ratification supplies it", () => {
    const document = axiomFileTemplate({
      ...vars(),
      groundedIn: "src/services/README.md#behavior",
    });

    expect(document).toContain("grounded_in: src/services/README.md#behavior");
  });

  it("carries both examples under their section headings", () => {
    const document = axiomFileTemplate(vars());

    expect(document).toContain("## Violating example");
    expect(document).toContain("## Compliant example");
  });
});
