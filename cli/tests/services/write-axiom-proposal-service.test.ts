import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AxiomFile } from "@/models/axiom-file.js";
import writeAxiomProposalService from "@/services/write-axiom-proposal-service.js";

/** A draft as triage would accept it. */
function draft() {
  return {
    statement: "Error messages name what would be accepted instead.",
    severity: "warning" as const,
    scope: "file" as const,
    violatingExample: "`bad subject`",
    compliantExample: "`subject must be a non-empty string`",
  };
}

describe("writeAxiomProposalService", () => {
  let root: string;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-axiom-proposal-test-${randomUUID()}`);
    mkdirSync(root, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("lands a valid proposed axiom under .praxis/axioms/proposed/", () => {
    const { id, path } = writeAxiomProposalService({ root, ...draft() });

    const written = AxiomFile.fromContent(readFileSync(path, "utf8"), path);

    expect(path).toBe(join(root, ".praxis", "axioms", "proposed", `${id}.md`));
    expect(written.id).toBe(id);
    expect(written.status).toBe("proposed");
    expect(written.version).toBe(1);
    expect(written.groundedIn).toBeNull();
    expect(written.severity).toBe("warning");
  });

  it("stamps introduced with today's date — the axiom's population clock", () => {
    const { path } = writeAxiomProposalService({ root, ...draft() });

    const written = AxiomFile.fromContent(readFileSync(path, "utf8"), path);
    const today = new Date().toISOString().slice(0, 10);

    expect(written.introduced).toBe(today);
  });

  it("mints a distinct id per proposal", () => {
    const first = writeAxiomProposalService({ root, ...draft() });
    const second = writeAxiomProposalService({ root, ...draft() });

    expect(second.id).not.toBe(first.id);
  });
});
