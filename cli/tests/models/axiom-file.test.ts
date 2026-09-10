import { describe, expect, it } from "vitest";

import { AxiomFile } from "@/models/axiom-file.js";
import { axiomContent as sharedAxiomContent } from "@tests/helpers/axiom-fixtures.js";

/** The shared fixture, pinned to this file's canonical example axiom. */
function axiomContent(overrides: Record<string, string | null> = {}, body?: string): string {
  return sharedAxiomContent(
    { id: "AX-3f9c2d", grounded_in: "docs/README.md#payloads", ...overrides },
    {
      statement: "Payloads capture a complete snapshot at emission time.",
      ...(body !== undefined && { body }),
    },
  );
}

describe("AxiomFile", () => {
  it("reads a valid axiom, defaults included", () => {
    const axiom = AxiomFile.fromContent(axiomContent(), "AX-3f9c2d.md");

    expect(axiom.id).toBe("AX-3f9c2d");
    expect(axiom.version).toBe(1);
    expect(axiom.status).toBe("active");
    expect(axiom.mode).toBe("judgment");
    expect(axiom.severity).toBe("error");
    expect(axiom.derivedFrom).toBe("docs/README.md#payloads");
    expect(axiom.introduced).toBe("2026-08-29");
  });

  it("statement() is the body before the first section heading", () => {
    const axiom = AxiomFile.fromContent(axiomContent(), "a.md");

    expect(axiom.statement()).toBe("Payloads capture a complete snapshot at emission time.");
  });

  it("statement() is the whole body when no examples exist yet", () => {
    const axiom = AxiomFile.fromContent(axiomContent({}, "Just the statement."), "a.md");

    expect(axiom.statement()).toBe("Just the statement.");
  });

  it("derived_from is null until ratification writes it", () => {
    const axiom = AxiomFile.fromContent(
      axiomContent({ status: "proposed", grounded_in: null }),
      "a.md",
    );

    expect(axiom.derivedFrom).toBeNull();
  });

  it("a historical grounded_in key parses as derived_from", () => {
    const axiom = AxiomFile.fromContent(axiomContent(), "a.md");

    expect(axiom.derivedFrom).toBe("docs/README.md#payloads");
  });

  it("derived_from wins when both keys are present", () => {
    const axiom = AxiomFile.fromContent(
      axiomContent({ derived_from: "docs/README.md#errors" }),
      "a.md",
    );

    expect(axiom.derivedFrom).toBe("docs/README.md#errors");
  });

  it("rejects an id that is not AX- plus 6 hex", () => {
    const readBadId = () => AxiomFile.fromContent(axiomContent({ id: "AX-0007" }), "a.md");

    expect(readBadId).toThrow(/an id like AX-3f9c2d/);
  });

  it("tolerates a missing severity — categories carry none", () => {
    const axiom = AxiomFile.fromContent(axiomContent({ severity: null }), "a.md");

    expect(axiom.severity).toBeNull();
  });

  it("rejects a status outside the lifecycle", () => {
    const readBadStatus = () => AxiomFile.fromContent(axiomContent({ status: "draft" }), "a.md");

    expect(readBadStatus).toThrow(/status/);
  });

  it("rejects a non-integer version", () => {
    const readBadVersion = () => AxiomFile.fromContent(axiomContent({ version: "1.5" }), "a.md");

    expect(readBadVersion).toThrow(/whole number/);
  });

  it("accepts the schema-only mode and ignores retired keys", () => {
    const axiom = AxiomFile.fromContent(
      axiomContent({ mode: "agentic", scope: "cohort", supersedes: "AX-9e21aa" }),
      "a.md",
    );

    expect(axiom.mode).toBe("agentic");
  });
});
