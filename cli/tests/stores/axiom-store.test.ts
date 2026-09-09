import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AxiomFile } from "@/models/axiom-file.js";
import { AxiomStore } from "@/stores/axiom-store.js";
import { seedAxiom as seedSharedAxiom } from "@tests/helpers/axiom-fixtures.js";
import { testConfig } from "@tests/helpers/test-config.js";

/** A draft as triage would accept it. */
function accepted() {
  return {
    statement: "Error messages name what would be accepted instead.",
    severity: "warning" as const,
    violatingExample: "`bad subject`",
    compliantExample: "`subject must be a non-empty string`",
    derivedFrom: "docs/README.md#error-messages",
  };
}

describe("AxiomStore", () => {
  let root: string;
  let store: AxiomStore;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-axiom-store-test-${randomUUID()}`);
    mkdirSync(root, { recursive: true });
    store = new AxiomStore(testConfig(root));
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
      derivedFrom?: string;
      proposed?: boolean;
    } = {},
  ): void {
    seedSharedAxiom(root, id, {
      version: "2",
      severity: "warning",
      ...(fields.status !== undefined && { status: fields.status }),
      ...(fields.introduced !== undefined && { introduced: fields.introduced }),
      ...(fields.derivedFrom !== undefined && { derived_from: fields.derivedFrom }),
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

  describe("active", () => {
    const SPEC = "docs/README.md";

    it("selects every active axiom, with its teaching material", () => {
      seedAxiom("AX-aaaa11", { derivedFrom: `${SPEC}#payloads` });

      const checklist = store.active();

      expect(checklist).toHaveLength(1);
      expect(checklist[0]).toMatchObject({
        id: "AX-aaaa11",
        version: 2,
        severity: "warning",
        statement: "Statement of AX-aaaa11.",
      });
    });

    it("excludes proposed and deprecated axioms — they never label", () => {
      seedAxiom("AX-aaaa11", { status: "proposed", derivedFrom: SPEC, proposed: true });
      seedAxiom("AX-bbbb22", { status: "deprecated", derivedFrom: SPEC });

      expect(store.active()).toEqual([]);
    });

    it("includes every active axiom regardless of derivation, sorted by id", () => {
      // An axiom is an abstraction, never a child of one spec: axioms
      // derived from any spec (or none) all label.
      seedAxiom("AX-cccc33", { derivedFrom: SPEC });
      seedAxiom("AX-aaaa11", { derivedFrom: `${SPEC}#section` });
      seedAxiom("AX-bbbb22");
      seedAxiom("AX-dddd44", { derivedFrom: "src/services/README.md#behavior" });

      const ids = store.active().map((axiom) => axiom.id);

      expect(ids).toEqual(["AX-aaaa11", "AX-bbbb22", "AX-cccc33", "AX-dddd44"]);
    });
  });

  describe("createActive", () => {
    it("lands a valid active axiom with a minted id and its derivation", () => {
      const { id, path } = store.createActive(accepted());

      const written = AxiomFile.fromContent(readFileSync(path, "utf8"), path);

      expect(id).toMatch(/^AX-[0-9a-f]{6}$/);
      expect(path).toBe(join(root, ".praxis", "axioms", `${id}.md`));
      expect(written.status).toBe("active");
      expect(written.version).toBe(1);
      expect(written.derivedFrom).toBe("docs/README.md#error-messages");
      expect(written.statement()).toBe(accepted().statement);
    });

    it("stamps introduced with today's date — the axiom's population clock", () => {
      const { path } = store.createActive(accepted());

      const written = AxiomFile.fromContent(readFileSync(path, "utf8"), path);
      const today = new Date().toISOString().slice(0, 10);

      expect(written.introduced).toBe(today);
    });

    it("mints a distinct id per acceptance — random, never sequential", () => {
      const first = store.createActive(accepted());
      const second = store.createActive(accepted());

      expect(second.id).not.toBe(first.id);
    });
  });
});
