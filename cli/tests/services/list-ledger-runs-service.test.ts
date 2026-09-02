import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import listLedgerRunsService from "@/services/list-ledger-runs-service.js";
import { seedLedgerRun } from "@tests/helpers/ledger-runs.js";

describe("listLedgerRunsService", () => {
  let root: string;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-ledger-list-test-${randomUUID()}`);
    mkdirSync(root, { recursive: true });
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

  it("returns nothing for a project with no ledger", () => {
    const runs = listLedgerRunsService({ root });

    expect(runs).toEqual([]);
  });

  it("returns each file's run record, never its critique records", () => {
    const critiqueLine = JSON.stringify({ kind: "critique", id: "r1:1" });
    seedLedgerRun(root, { name: "flash", hash: "aaaa1111", extraLines: [critiqueLine] });
    seedLedgerRun(root, { name: "v32", hash: "bbbb2222" });

    const runs = listLedgerRunsService({ root });
    const names = runs.map((run) => run.reviewer_name).sort();

    expect(names).toEqual(["flash", "v32"]);
    expect(runs.every((run) => run.kind === "run")).toBe(true);
  });

  it("skips a corrupt file without losing the readable ones", () => {
    seedRawFile("corrupt.jsonl", "not json at all\n");
    seedLedgerRun(root, { name: "flash", hash: "aaaa1111" });

    const runs = listLedgerRunsService({ root });
    const names = runs.map((run) => run.reviewer_name);

    expect(names).toEqual(["flash"]);
  });

  it("skips a file whose first line is not a run record", () => {
    const critiqueLine = JSON.stringify({ kind: "critique", id: "x:1" });
    seedRawFile("odd.jsonl", critiqueLine + "\n");

    const runs = listLedgerRunsService({ root });

    expect(runs).toEqual([]);
  });
});
