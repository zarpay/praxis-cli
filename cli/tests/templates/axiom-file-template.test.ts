import { describe, expect, it } from "vitest";

import { AxiomFile } from "@/models/axiom-file.js";
import axiomFileTemplate from "@/templates/axiom-file-template.js";

/** The vars a curate-accepted category supplies. */
function vars() {
  return {
    id: "AX-3f9c2d",
    status: "active" as const,
    mode: "judgment" as const,
    introduced: "2026-09-02",
    derivedFrom: "src/services/README.md#behavior",
    statement: "Error messages written for the implementer, not the API consumer.",
  };
}

describe("axiomFileTemplate", () => {
  it("renders a document the AxiomFile model accepts", () => {
    const document = axiomFileTemplate(vars());

    const axiom = AxiomFile.fromContent(document, "AX-3f9c2d.md");

    expect(axiom.id).toBe("AX-3f9c2d");
    expect(axiom.status).toBe("active");
    expect(axiom.version).toBe(1);
    expect(axiom.derivedFrom).toBe("src/services/README.md#behavior");
    expect(axiom.statement()).toBe(
      "Error messages written for the implementer, not the API consumer.",
    );
  });

  it("is frontmatter plus the statement — no severity, no example sections", () => {
    const document = axiomFileTemplate(vars());

    expect(document).not.toContain("severity:");
    expect(document).not.toContain("## Violating example");
    expect(document).not.toContain("## Compliant example");
  });
});
