import type { TriageRecord } from "@/types.js";

import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Ledger } from "@/models/ledger.js";
import { seedLedgerRun } from "@tests/helpers/ledger-runs.js";

/** One open-channel critique line for a seeded run. */
function critiqueLine(id: string, fields: { axiomId?: string | null; spec?: string } = {}): string {
  return JSON.stringify({
    kind: "critique",
    id,
    run_id: "r1",
    timestamp: "2026-09-02T10:00:00.000Z",
    file_path: "src/a.ts",
    spec_path: fields.spec ?? "src/README.md",
    severity: "error",
    text: `Critique ${id}`,
    reviewer_name: "flash",
    axiom_id: fields.axiomId ?? null,
  });
}

describe("Ledger", () => {
  let root: string;
  let ledger: Ledger;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-ledger-model-test-${randomUUID()}`);
    mkdirSync(root, { recursive: true });
    ledger = new Ledger({ projectRoot: root });
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
      const first = ledger.mintRunId();
      const second = ledger.mintRunId();

      expect(first).toMatch(/^\d{8}T\d{9}Z-[0-9a-f]{8}$/);
      expect(second).not.toBe(first);
    });
  });

  describe("runs", () => {
    it("returns nothing for a project with no ledger", () => {
      expect(ledger.runs()).toEqual([]);
    });

    it("returns each file's run record, never its critique records", () => {
      seedLedgerRun(root, { name: "flash", hash: "aaaa1111", extraLines: [critiqueLine("r1:1")] });
      seedLedgerRun(root, { name: "v32", hash: "bbbb2222" });

      const runs = ledger.runs();
      const names = runs.map((run) => run.reviewer_name).sort();

      expect(names).toEqual(["flash", "v32"]);
      expect(runs.every((run) => run.kind === "run")).toBe(true);
    });

    it("skips a corrupt file without losing the readable ones", () => {
      seedRawFile("corrupt.jsonl", "not json at all\n");
      seedLedgerRun(root, { name: "flash", hash: "aaaa1111" });

      const names = ledger.runs().map((run) => run.reviewer_name);

      expect(names).toEqual(["flash"]);
    });

    it("skips a file whose first line is not a run record", () => {
      seedRawFile("odd.jsonl", critiqueLine("x:1") + "\n");

      expect(ledger.runs()).toEqual([]);
    });
  });

  describe("critiques", () => {
    it("returns every critique line across run files, sorted by id", () => {
      seedLedgerRun(root, {
        name: "flash",
        hash: "aaaa1111",
        extraLines: [critiqueLine("r1:2"), critiqueLine("r1:1")],
      });

      const ids = ledger.critiques().map((critique) => critique.id);

      expect(ids).toEqual(["r1:1", "r1:2"]);
    });
  });

  describe("writeRun", () => {
    it("lands the records as one run file, named by the id", () => {
      const runId = ledger.mintRunId();

      const { path } = ledger.writeRun(runId, [{ kind: "run", run_id: runId } as never]);

      expect(path).toBe(join(root, ".praxis", "ledger", "runs", `${runId}.jsonl`));
      expect(ledger.runs()).toHaveLength(1);
    });
  });

  describe("triageState", () => {
    it("derives an empty queue from an empty ledger", () => {
      expect(ledger.triageState()).toEqual({
        pending: [],
        assignments: [],
        dismissed: 0,
        rejectedProposals: 0,
      });
    });

    it("pends open-channel critiques; checklist-born ones were never pending", () => {
      seedLedgerRun(root, {
        name: "flash",
        hash: "aaaa1111",
        extraLines: [critiqueLine("r1:1"), critiqueLine("r1:2", { axiomId: "AX-aaaa11" })],
      });

      const { pending } = ledger.triageState();
      const ids = pending.map((critique) => critique.id);

      expect(ids).toEqual(["r1:1"]);
      expect(pending[0]).toMatchObject({
        filePath: "src/a.ts",
        specPath: "src/README.md",
        reviewerName: "flash",
      });
    });

    it("settles critiques that assignment or dismissal records cover", () => {
      seedLedgerRun(root, {
        name: "flash",
        hash: "aaaa1111",
        extraLines: [critiqueLine("r1:1"), critiqueLine("r1:2"), critiqueLine("r1:3")],
      });

      const records: TriageRecord[] = [
        {
          kind: "assignment",
          critique_id: "r1:1",
          axiom_id: "AX-aaaa11",
          axiom_version: 1,
          assigned_by: { decision: "human", suggested_by: "big/model" },
          timestamp: "2026-09-03T10:00:00.000Z",
        },
        {
          kind: "dismissal",
          critique_id: "r1:2",
          reason: "unassignable: off-spec",
          timestamp: "2026-09-03T10:00:00.000Z",
        },
      ];
      ledger.appendTriageSession(records);

      const state = ledger.triageState();
      const ids = state.pending.map((critique) => critique.id);

      expect(ids).toEqual(["r1:3"]);
      expect(state.assignments).toHaveLength(1);
      expect(state.dismissed).toBe(1);
    });

    it("counts rejections for the residual signal", () => {
      ledger.appendTriageSession([
        {
          kind: "rejection",
          axiom_id: "AX-bbbb22",
          reason: "reviewer invention",
          timestamp: "2026-09-03T10:00:00.000Z",
        },
      ]);

      expect(ledger.triageState().rejectedProposals).toBe(1);
    });
  });

  describe("appendTriageSession", () => {
    it("lands each session as its own file under ledger/triage", () => {
      const first = ledger.appendTriageSession([
        { kind: "dismissal", critique_id: "r1:1", reason: "x", timestamp: "t" },
      ]);
      const second = ledger.appendTriageSession([
        { kind: "dismissal", critique_id: "r1:2", reason: "y", timestamp: "t" },
      ]);

      expect(first.path).toContain(join(".praxis", "ledger", "triage"));
      expect(second.path).not.toBe(first.path);
      expect(ledger.triageRecords()).toHaveLength(2);
    });
  });
});
