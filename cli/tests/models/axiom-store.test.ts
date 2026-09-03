import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AxiomFile } from "@/models/axiom-file.js";
import { AxiomStore } from "@/models/axiom-store.js";
import { seedAxiom as seedSharedAxiom } from "@tests/helpers/axiom-fixtures.js";

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

describe("AxiomStore", () => {
  let root: string;
  let store: AxiomStore;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-axiom-store-test-${randomUUID()}`);
    mkdirSync(root, { recursive: true });
    store = new AxiomStore({ projectRoot: root });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /** Writes one v2 warning axiom into the store, this suite's default shape. */
  function seedAxiom(
    id: string,
    fields: {
      status?: string;
      introduced?: string;
      groundedIn?: string;
      proposed?: boolean;
    } = {},
  ): void {
    seedSharedAxiom(root, id, {
      version: "2",
      severity: "warning",
      ...(fields.status !== undefined && { status: fields.status }),
      ...(fields.introduced !== undefined && { introduced: fields.introduced }),
      ...(fields.groundedIn !== undefined && { grounded_in: fields.groundedIn }),
      ...(fields.proposed !== undefined && { proposed: fields.proposed }),
    });
  }

  describe("all", () => {
    it("returns an empty store for a project with no axioms directory", () => {
      expect(store.all()).toEqual({ axioms: [], problems: [] });
    });

    it("loads active and proposed axioms together", () => {
      seedAxiom("AX-aaaa11");
      seedAxiom("AX-bbbb22", { status: "proposed", proposed: true });

      const ids = store
        .all()
        .axioms.map((axiom) => axiom.id)
        .sort();

      expect(ids).toEqual(["AX-aaaa11", "AX-bbbb22"]);
    });

    it("sorts by introduced date, id as tiebreak", () => {
      seedAxiom("AX-cccc33", { introduced: "2026-09-01" });
      seedAxiom("AX-aaaa11", { introduced: "2026-08-01" });
      seedAxiom("AX-bbbb22", { introduced: "2026-09-01" });

      const ids = store.all().axioms.map((axiom) => axiom.id);

      expect(ids).toEqual(["AX-aaaa11", "AX-bbbb22", "AX-cccc33"]);
    });

    it("reports a malformed file as a problem without losing the rest", () => {
      seedAxiom("AX-aaaa11");
      writeFileSync(
        join(root, ".praxis", "axioms", "AX-broken.md"),
        "---\nid: AX-broken\n---\nno version, no status",
      );

      const { axioms, problems } = store.all();

      expect(axioms.map((axiom) => axiom.id)).toEqual(["AX-aaaa11"]);
      expect(problems).toHaveLength(1);
      expect(problems[0].path).toContain("AX-broken.md");
    });
  });

  describe("checklistFor", () => {
    const SPEC = "docs/README.md";

    it("selects active axioms grounded in the spec, with their teaching material", () => {
      seedAxiom("AX-aaaa11", { groundedIn: `${SPEC}#payloads` });

      const checklist = store.checklistFor(join(root, SPEC));

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

      expect(store.checklistFor(join(root, SPEC))).toEqual([]);
    });

    it("excludes axioms grounded elsewhere or nowhere, sorted by id", () => {
      seedAxiom("AX-cccc33", { groundedIn: SPEC });
      seedAxiom("AX-aaaa11", { groundedIn: `${SPEC}#section` });
      seedAxiom("AX-bbbb22");
      seedAxiom("AX-dddd44", { groundedIn: "src/services/README.md#behavior" });

      const ids = store.checklistFor(join(root, SPEC)).map((axiom) => axiom.id);

      expect(ids).toEqual(["AX-aaaa11", "AX-cccc33"]);
    });
  });

  describe("propose", () => {
    it("lands a valid proposed axiom under proposed/ with a minted id", () => {
      const { id, path } = store.propose(draft());

      const written = AxiomFile.fromContent(readFileSync(path, "utf8"), path);

      expect(id).toMatch(/^AX-[0-9a-f]{6}$/);
      expect(path).toBe(join(root, ".praxis", "axioms", "proposed", `${id}.md`));
      expect(written.status).toBe("proposed");
      expect(written.version).toBe(1);
      expect(written.groundedIn).toBeNull();
    });

    it("stamps introduced with today's date — the axiom's population clock", () => {
      const { path } = store.propose(draft());

      const written = AxiomFile.fromContent(readFileSync(path, "utf8"), path);
      const today = new Date().toISOString().slice(0, 10);

      expect(written.introduced).toBe(today);
    });

    it("mints a distinct id per proposal — random, never sequential", () => {
      const first = store.propose(draft());
      const second = store.propose(draft());

      expect(second.id).not.toBe(first.id);
    });
  });

  describe("ratify", () => {
    it("activates the proposal with its grounding, preserving the body", () => {
      const { id } = store.propose(draft());

      const { path } = store.ratify(id, "docs/README.md#error-messages");
      const ratified = AxiomFile.at(path);

      expect(ratified.status).toBe("active");
      expect(ratified.groundedIn).toBe("docs/README.md#error-messages");
      expect(ratified.statement()).toBe(draft().statement);
      expect(existsSync(join(root, ".praxis", "axioms", "proposed", `${id}.md`))).toBe(false);
    });
  });
});
