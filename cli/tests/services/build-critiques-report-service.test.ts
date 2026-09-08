import type { TriageRecord } from "@/types.js";

import { afterEach, describe, expect, it } from "vitest";

import buildCritiquesReportService from "@/services/build-critiques-report-service.js";
import { TriageStore } from "@/stores/triage-store.js";
import { axiomContent } from "@tests/helpers/axiom-fixtures.js";
import { critiqueLine, seedLedgerRun } from "@tests/helpers/ledger-runs.js";
import { testConfig } from "@tests/helpers/test-config.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

/** A ledger with one critique per lifecycle state, plus one active axiom. */
function statesProject(): string {
  const axiom = axiomContent(
    { id: "AX-aaaa11", grounded_in: "docs/README.md#errors" },
    { statement: "Error messages name what would be accepted." },
  );
  const { root, cleanup } = createValidatorTmpdir({
    sources: ["docs"],
    files: {
      "docs/README.md": "# Spec",
      "docs/guide.md": "# Guide",
      [".praxis/axioms/AX-aaaa11.md"]: axiom,
    },
  });
  cleanups.push(cleanup);

  seedLedgerRun(root, {
    name: "flash",
    hash: "aaaa1111",
    runId: "r1",
    extraLines: [1, 2, 3, 4, 5].map((seq) =>
      critiqueLine({
        runId: "r1",
        seq,
        filePath: seq === 5 ? "docs/other.md" : "docs/guide.md",
        specPath: "docs/README.md",
        text: `Critique ${seq}.`,
      }),
    ),
  });

  const records: TriageRecord[] = [
    {
      kind: "assignment",
      critique_id: "r1:1",
      axiom_id: "AX-aaaa11",
      axiom_version: 1,
      assigned_by: { decision: "matcher", suggested_by: "scripted" },
      timestamp: "2026-09-07T10:00:00.000Z",
    },
    {
      kind: "dismissal",
      critique_id: "r1:2",
      reason: "noise",
      timestamp: "2026-09-07T10:00:00.000Z",
    },
    {
      kind: "unmatched",
      critique_id: "r1:3",
      considered: ["AX-aaaa11@1"],
      suggested_by: "scripted",
      timestamp: "2026-09-07T10:00:00.000Z",
    },
    {
      kind: "unmatched",
      critique_id: "r1:4",
      considered: ["AX-gone00@1"],
      suggested_by: "scripted",
      timestamp: "2026-09-07T10:00:00.000Z",
    },
  ];
  new TriageStore(testConfig(root)).writeSession(records);

  return root;
}

describe("buildCritiquesReportService", () => {
  it("resolves each critique's lifecycle state the way readers do", () => {
    const root = statesProject();

    const { rows, totals } = buildCritiquesReportService(testConfig(root), {});
    const states = new Map(rows.map((row) => [row.id, row.state]));

    expect(states.get("r1:1")).toBe("labeled");
    expect(states.get("r1:2")).toBe("dismissed");
    expect(states.get("r1:3")).toBe("unmatched");
    // Judged against a set that no longer exists — back to triage.
    expect(states.get("r1:4")).toBe("untriaged");
    expect(states.get("r1:5")).toBe("untriaged");
    expect(totals).toEqual({ untriaged: 2, unmatched: 1, labeled: 1, dismissed: 1 });
  });

  it("filters by target prefix, axiom, and state — totals stay ledger-wide", () => {
    const root = statesProject();
    const cfg = testConfig(root);

    const byTarget = buildCritiquesReportService(cfg, { target: "docs/other.md" });
    expect(byTarget.rows.map((row) => row.id)).toEqual(["r1:5"]);
    expect(byTarget.totals.labeled).toBe(1);

    const byAxiom = buildCritiquesReportService(cfg, { axiom: "AX-aaaa11" });
    expect(byAxiom.rows.map((row) => row.id)).toEqual(["r1:1"]);

    const byState = buildCritiquesReportService(cfg, { state: "unmatched" });
    expect(byState.rows.map((row) => row.id)).toEqual(["r1:3"]);
  });
});
