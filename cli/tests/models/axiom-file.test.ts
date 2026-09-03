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
    expect(axiom.scope).toBe("file");
    expect(axiom.severity).toBe("error");
    expect(axiom.groundedIn).toBe("docs/README.md#payloads");
    expect(axiom.introduced).toBe("2026-08-29");
    expect(axiom.supersedes).toBeUndefined();
  });

  it("statement() is the body before the first section heading", () => {
    const axiom = AxiomFile.fromContent(axiomContent(), "a.md");

    expect(axiom.statement()).toBe("Payloads capture a complete snapshot at emission time.");
  });

  it("statement() is the whole body when no examples exist yet", () => {
    const axiom = AxiomFile.fromContent(axiomContent({}, "Just the statement."), "a.md");

    expect(axiom.statement()).toBe("Just the statement.");
  });

  it("grounded_in is null until ratification writes it", () => {
    const axiom = AxiomFile.fromContent(
      axiomContent({ status: "proposed", grounded_in: null }),
      "a.md",
    );

    expect(axiom.groundedIn).toBeNull();
  });

  it("rejects an id that is not AX- plus 6 hex", () => {
    const readBadId = () => AxiomFile.fromContent(axiomContent({ id: "AX-0007" }), "a.md");

    expect(readBadId).toThrow(/an id like AX-3f9c2d/);
  });

  it("rejects a missing severity", () => {
    const readNoSeverity = () => AxiomFile.fromContent(axiomContent({ severity: null }), "a.md");

    expect(readNoSeverity).toThrow(/severity/);
  });

  it("rejects a status outside the lifecycle", () => {
    const readBadStatus = () => AxiomFile.fromContent(axiomContent({ status: "draft" }), "a.md");

    expect(readBadStatus).toThrow(/status/);
  });

  it("rejects a non-integer version", () => {
    const readBadVersion = () => AxiomFile.fromContent(axiomContent({ version: "1.5" }), "a.md");

    expect(readBadVersion).toThrow(/whole number/);
  });

  it("accepts supersedes and the schema-only modes and scopes", () => {
    const axiom = AxiomFile.fromContent(
      axiomContent({ mode: "agentic", scope: "cohort", supersedes: "AX-9e21aa" }),
      "a.md",
    );

    expect(axiom.mode).toBe("agentic");
    expect(axiom.scope).toBe("cohort");
    expect(axiom.supersedes).toBe("AX-9e21aa");
  });
});
