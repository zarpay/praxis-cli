import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { RunStore } from "@/stores/run-store.js";
import { critiqueLine, seedLedgerRun } from "@tests/helpers/ledger-runs.js";
import { testConfig } from "@tests/helpers/test-config.js";

describe("RunStore", () => {
  let root: string;
  let store: RunStore;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-run-store-test-${randomUUID()}`);
    mkdirSync(root, { recursive: true });
    store = new RunStore(testConfig(root));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /** Writes one raw file into the runs directory, however malformed. */
  function seedRawFile(name: string, content: string): void {
    const dir = join(root, ".praxis", "ledger", "runs");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, name), content);
  }

  describe("mintRunId", () => {
    it("mints sortable, collision-safe ids", () => {
      const first = store.mintRunId();
      const second = store.mintRunId();

      expect(first).toMatch(/^\d{8}T\d{9}Z-[0-9a-f]{8}$/);
      expect(second).not.toBe(first);
    });
  });

  describe("runs", () => {
    it("returns nothing for a project with no ledger", () => {
      expect(store.runs()).toEqual([]);
    });

    it("returns each file's run record, never its critique records", () => {
      seedLedgerRun(root, {
        name: "flash",
        hash: "aaaa1111",
        extraLines: [critiqueLine({ runId: "r1", seq: 1 })],
      });
      seedLedgerRun(root, { name: "v32", hash: "bbbb2222" });

      const runs = store.runs();
      const names = runs.map((run) => run.reviewer_name).sort();

      expect(names).toEqual(["flash", "v32"]);
      expect(runs.every((run) => run.kind === "run")).toBe(true);
    });

    it("skips a corrupt file without losing the readable ones", () => {
      seedRawFile("corrupt.jsonl", "not json at all\n");
      seedLedgerRun(root, { name: "flash", hash: "aaaa1111" });

      const names = store.runs().map((run) => run.reviewer_name);

      expect(names).toEqual(["flash"]);
    });

    it("skips a file whose first line is not a run record", () => {
      seedRawFile("odd.jsonl", critiqueLine({ runId: "x", seq: 1 }) + "\n");

      expect(store.runs()).toEqual([]);
    });
  });

  describe("critiques", () => {
    it("returns every critique line across run files, sorted by id", () => {
      seedLedgerRun(root, {
        name: "flash",
        hash: "aaaa1111",
        extraLines: [critiqueLine({ runId: "r1", seq: 2 }), critiqueLine({ runId: "r1", seq: 1 })],
      });

      const ids = store.critiques().map((critique) => critique.id);

      expect(ids).toEqual(["r1:1", "r1:2"]);
    });
  });

  describe("writeRun", () => {
    it("lands the records as one run file, named by the id", () => {
      const runId = store.mintRunId();

      const { path } = store.writeRun(runId, [{ kind: "run", run_id: runId } as never]);

      expect(path).toBe(join(root, ".praxis", "ledger", "runs", `${runId}.jsonl`));
      expect(store.runs()).toHaveLength(1);
    });
  });
});
