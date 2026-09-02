import type { TriageRecord } from "@/types.js";

import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import listTriageStateService from "@/services/list-triage-state-service.js";
import writeTriageRecordsService from "@/services/write-triage-records-service.js";
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

describe("listTriageStateService", () => {
  let root: string;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-triage-state-test-${randomUUID()}`);
    mkdirSync(root, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("derives an empty queue from an empty ledger", () => {
    const state = listTriageStateService({ root });

    expect(state).toEqual({ pending: [], assignments: [], dismissed: 0, rejectedProposals: 0 });
  });

  it("pends open-channel critiques; checklist-born ones were never pending", () => {
    seedLedgerRun(root, {
      name: "flash",
      hash: "aaaa1111",
      extraLines: [critiqueLine("r1:1"), critiqueLine("r1:2", { axiomId: "AX-aaaa11" })],
    });

    const { pending } = listTriageStateService({ root });
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
    writeTriageRecordsService({ root, records });

    const state = listTriageStateService({ root });
    const ids = state.pending.map((critique) => critique.id);

    expect(ids).toEqual(["r1:3"]);
    expect(state.assignments).toHaveLength(1);
    expect(state.dismissed).toBe(1);
  });

  it("counts rejections for the residual signal", () => {
    writeTriageRecordsService({
      root,
      records: [
        {
          kind: "rejection",
          axiom_id: "AX-bbbb22",
          reason: "reviewer invention",
          timestamp: "2026-09-03T10:00:00.000Z",
        },
      ],
    });

    const state = listTriageStateService({ root });

    expect(state.rejectedProposals).toBe(1);
  });
});
