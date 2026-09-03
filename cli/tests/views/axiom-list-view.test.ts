import { describe, expect, it } from "vitest";

import { AxiomFile } from "@/models/axiom-file.js";
import axiomListView from "@/views/axiom-list-view.js";
import { axiomContent } from "@tests/helpers/axiom-fixtures.js";
import { reportText } from "@tests/helpers/report-text.js";

/** One in-memory axiom for the view to arrange. */
function axiom(id: string, fields: { status?: string; introduced?: string } = {}): AxiomFile {
  const content = axiomContent(
    { id, grounded_in: null, ...fields },
    { statement: `Statement of ${id}.` },
  );

  return AxiomFile.fromContent(content, `${id}.md`);
}

describe("axiomListView", () => {
  it("names the bootstrap path when the store is empty", () => {
    const text = reportText(axiomListView({ axioms: [], problems: [] }));

    expect(text).toContain("praxis axioms triage");
  });

  it("renders one line per axiom with identity, state, and statement", () => {
    const lines = axiomListView({ axioms: [axiom("AX-aaaa11")], problems: [] });
    const text = reportText(lines);

    expect(text).toContain("AX-aaaa11");
    expect(text).toContain("active");
    expect(text).toContain("Statement of AX-aaaa11.");
  });

  it("counts proposals and names the ratify command", () => {
    const axioms = [axiom("AX-aaaa11"), axiom("AX-bbbb22", { status: "proposed" })];

    const text = reportText(axiomListView({ axioms, problems: [] }));

    expect(text).toContain("1 proposed of 2");
    expect(text).toContain("praxis axioms ratify");
  });

  it("surfaces unreadable files as warnings", () => {
    const problems = [{ path: "/store/AX-broken.md", message: "missing severity" }];

    const text = reportText(axiomListView({ axioms: [], problems }));

    expect(text).toContain("[WARN]");
    expect(text).toContain("AX-broken.md");
  });

  it("renders the stable JSON contract when asked", () => {
    const lines = axiomListView({ axioms: [axiom("AX-aaaa11")], problems: [], json: true });
    const parsed = JSON.parse(reportText(lines)) as Record<string, unknown>[];

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      id: "AX-aaaa11",
      status: "active",
      grounded_in: null,
      statement: "Statement of AX-aaaa11.",
    });
  });
});
