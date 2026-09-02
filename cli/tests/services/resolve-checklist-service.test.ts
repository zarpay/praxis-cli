import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import resolveChecklistService from "@/services/resolve-checklist-service.js";

describe("resolveChecklistService", () => {
  let root: string;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-checklist-test-${randomUUID()}`);
    mkdirSync(root, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /** Seeds one axiom into the store. */
  function seedAxiom(
    id: string,
    fields: { status?: string; groundedIn?: string; proposed?: boolean } = {},
  ): void {
    const dir = fields.proposed
      ? join(root, ".praxis", "axioms", "proposed")
      : join(root, ".praxis", "axioms");
    mkdirSync(dir, { recursive: true });

    const grounding = fields.groundedIn ? [`grounded_in: ${fields.groundedIn}`] : [];
    const content = [
      "---",
      `id: ${id}`,
      "version: 2",
      `status: ${fields.status ?? "active"}`,
      "severity: warning",
      ...grounding,
      "introduced: 2026-08-29",
      "---",
      "",
      `Statement of ${id}.`,
    ].join("\n");

    writeFileSync(join(dir, `${id}.md`), content);
  }

  const SPEC = "docs/README.md";

  it("selects active axioms grounded in the spec, with their teaching material", () => {
    seedAxiom("AX-aaaa11", { groundedIn: `${SPEC}#payloads` });

    const checklist = resolveChecklistService({ root, specPath: join(root, SPEC) });

    expect(checklist).toHaveLength(1);
    expect(checklist[0]).toMatchObject({
      id: "AX-aaaa11",
      version: 2,
      severity: "warning",
      statement: "Statement of AX-aaaa11.",
    });
  });

  it("excludes proposed and deprecated axioms — they never reach the reviewer", () => {
    seedAxiom("AX-aaaa11", { status: "proposed", groundedIn: SPEC, proposed: true });
    seedAxiom("AX-bbbb22", { status: "deprecated", groundedIn: SPEC });

    const checklist = resolveChecklistService({ root, specPath: join(root, SPEC) });

    expect(checklist).toEqual([]);
  });

  it("excludes axioms grounded in a different spec — grounding is per-spec", () => {
    seedAxiom("AX-aaaa11", { groundedIn: "src/services/README.md#behavior" });

    const checklist = resolveChecklistService({ root, specPath: join(root, SPEC) });

    expect(checklist).toEqual([]);
  });

  it("excludes ungrounded axioms and sorts the rest by id", () => {
    seedAxiom("AX-cccc33", { groundedIn: SPEC });
    seedAxiom("AX-aaaa11", { groundedIn: `${SPEC}#section` });
    seedAxiom("AX-bbbb22");

    const checklist = resolveChecklistService({ root, specPath: join(root, SPEC) });
    const ids = checklist.map((axiom) => axiom.id);

    expect(ids).toEqual(["AX-aaaa11", "AX-cccc33"]);
  });
});
