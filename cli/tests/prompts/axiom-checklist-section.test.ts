import type { ChecklistAxiom } from "@/types.js";

import { describe, expect, it } from "vitest";

import axiomChecklistSection from "@/prompts/axiom-checklist-section.js";

/** One checklist entry as resolve-checklist assembles it. */
function entry(id: string): ChecklistAxiom {
  return {
    id,
    version: 1,
    severity: "error",
    statement: `Statement of ${id}.`,
    body: `Statement of ${id}.\n\n## Violating example\n\nbad\n\n## Compliant example\n\ngood`,
  };
}

describe("axiomChecklistSection", () => {
  it("renders nothing for an empty checklist — bootstrap is the open channel alone", () => {
    const section = axiomChecklistSection([]);

    expect(section).toBe("");
  });

  it("renders each axiom with its id, severity, and full teaching material", () => {
    const section = axiomChecklistSection([entry("AX-aaaa11")]);

    expect(section).toContain("## AXIOM CHECKLIST");
    expect(section).toContain("### AX-aaaa11 — severity: error");
    expect(section).toContain("## Violating example");
    expect(section).toContain("## Compliant example");
  });

  it("instructs the reviewer to cite the axiom's id on violations", () => {
    const section = axiomChecklistSection([entry("AX-aaaa11")]);

    expect(section).toContain("with\nthat axiom's id");
  });
});
