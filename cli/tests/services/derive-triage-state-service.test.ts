import type { TriageRecord } from "@/types.js";

import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import deriveTriageStateService from "@/services/derive-triage-state-service.js";
import { TriageStore } from "@/stores/triage-store.js";
import { critiqueLine, seedLedgerRun } from "@tests/helpers/ledger-runs.js";
import { testConfig } from "@tests/helpers/test-config.js";

describe("deriveTriageStateService", () => {
  let root: string;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-triage-state-test-${randomUUID()}`);
    mkdirSync(root, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("derives an empty queue from an empty ledger", () => {
    expect(deriveTriageStateService(testConfig(root), {})).toEqual({
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
      extraLines: [
        critiqueLine({ runId: "r1", seq: 1 }),
        critiqueLine({ runId: "r1", seq: 2, axiomId: "AX-aaaa11" }),
      ],
    });

    const { pending } = deriveTriageStateService(testConfig(root), {});
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
      extraLines: [
        critiqueLine({ runId: "r1", seq: 1 }),
        critiqueLine({ runId: "r1", seq: 2 }),
        critiqueLine({ runId: "r1", seq: 3 }),
      ],
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
    new TriageStore(testConfig(root)).appendSession(records);

    const state = deriveTriageStateService(testConfig(root), {});
    const ids = state.pending.map((critique) => critique.id);

    expect(ids).toEqual(["r1:3"]);
    expect(state.assignments).toHaveLength(1);
    expect(state.dismissed).toBe(1);
  });

  it("counts rejections for the residual signal", () => {
    new TriageStore(testConfig(root)).appendSession([
      {
        kind: "rejection",
        axiom_id: "AX-bbbb22",
        reason: "reviewer invention",
        timestamp: "2026-09-03T10:00:00.000Z",
      },
    ]);

    expect(deriveTriageStateService(testConfig(root), {}).rejectedProposals).toBe(1);
  });
});
