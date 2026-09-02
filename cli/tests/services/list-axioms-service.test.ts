import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import listAxiomsService from "@/services/list-axioms-service.js";

describe("listAxiomsService", () => {
  let root: string;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-axiom-list-test-${randomUUID()}`);
    mkdirSync(root, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /** Writes one axiom file into the store (or its proposed/ subdir). */
  function seedAxiom(
    id: string,
    fields: { status?: string; introduced?: string; proposed?: boolean } = {},
  ): void {
    const dir = fields.proposed
      ? join(root, ".praxis", "axioms", "proposed")
      : join(root, ".praxis", "axioms");
    mkdirSync(dir, { recursive: true });

    const content = [
      "---",
      `id: ${id}`,
      "version: 1",
      `status: ${fields.status ?? "active"}`,
      "severity: error",
      `introduced: ${fields.introduced ?? "2026-08-29"}`,
      "---",
      "",
      `Statement of ${id}.`,
    ].join("\n");

    writeFileSync(join(dir, `${id}.md`), content);
  }

  it("returns an empty store for a project with no axioms directory", () => {
    const { axioms, problems } = listAxiomsService({ root });

    expect(axioms).toEqual([]);
    expect(problems).toEqual([]);
  });

  it("loads active and proposed axioms together", () => {
    seedAxiom("AX-aaaa11");
    seedAxiom("AX-bbbb22", { status: "proposed", proposed: true });

    const { axioms } = listAxiomsService({ root });
    const ids = axioms.map((axiom) => axiom.id).sort();

    expect(ids).toEqual(["AX-aaaa11", "AX-bbbb22"]);
  });

  it("sorts by introduced date, id as tiebreak", () => {
    seedAxiom("AX-cccc33", { introduced: "2026-09-01" });
    seedAxiom("AX-aaaa11", { introduced: "2026-08-01" });
    seedAxiom("AX-bbbb22", { introduced: "2026-09-01" });

    const { axioms } = listAxiomsService({ root });
    const ids = axioms.map((axiom) => axiom.id);

    expect(ids).toEqual(["AX-aaaa11", "AX-bbbb22", "AX-cccc33"]);
  });

  it("reports a malformed file as a problem without losing the rest", () => {
    seedAxiom("AX-aaaa11");
    const dir = join(root, ".praxis", "axioms");
    writeFileSync(join(dir, "AX-broken.md"), "---\nid: AX-broken\n---\nno version, no status");

    const { axioms, problems } = listAxiomsService({ root });
    const ids = axioms.map((axiom) => axiom.id);

    expect(ids).toEqual(["AX-aaaa11"]);
    expect(problems).toHaveLength(1);
    expect(problems[0].path).toContain("AX-broken.md");
  });
});
