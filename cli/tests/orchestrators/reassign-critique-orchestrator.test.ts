import type { TriageRecord } from "@/types.js";

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { reassignCritiqueOrchestrator } from "@/orchestrators/reassign-critique-orchestrator.js";
import { TriageStore } from "@/stores/triage-store.js";
import { axiomContent } from "@tests/helpers/axiom-fixtures.js";
import { createCaptureLogger } from "@tests/helpers/capture-logger.js";
import { testContext } from "@tests/helpers/command-context.js";
import { critiqueLine, seedLedgerRun } from "@tests/helpers/ledger-runs.js";
import { testConfig } from "@tests/helpers/test-config.js";
import { dismissalRecord } from "@tests/helpers/triage-records.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

/** One critique on the ledger, one active axiom to move it under. */
function reassignProject(): string {
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
    extraLines: [
      critiqueLine({
        runId: "r1",
        seq: 1,
        filePath: "docs/guide.md",
        specPath: "docs/README.md",
        text: "Error message 'bad subject' names nothing.",
      }),
    ],
  });

  return root;
}

/** Every triage record across session files. */
function triageRecords(root: string): TriageRecord[] {
  const dir = join(root, ".praxis", "ledger", "triage");

  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .sort()
    .flatMap((file) =>
      readFileSync(join(dir, file), "utf8")
        .trimEnd()
        .split("\n")
        .map((line) => JSON.parse(line) as TriageRecord),
    );
}

describe("reassignCritiqueOrchestrator", () => {
  it("appends a human assignment the join will prefer", async () => {
    const root = reassignProject();
    const { logger } = createCaptureLogger();

    const outcome = await reassignCritiqueOrchestrator(testContext(root, logger), {
      id: "r1:1",
      to: "AX-aaaa11",
    });

    expect(outcome).toBe("ok");

    const records = triageRecords(root);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      kind: "assignment",
      critique_id: "r1:1",
      axiom_id: "AX-aaaa11",
      axiom_version: 1,
      assigned_by: { decision: "human", suggested_by: "manual" },
    });
  });

  it("refuses a dismissed critique — invalid evidence is never categorized", async () => {
    const root = reassignProject();
    new TriageStore(testConfig(root)).writeSession([
      dismissalRecord({ reason: "the spec permits this", timestamp: "t" }),
    ]);

    const reassignDismissed = reassignCritiqueOrchestrator(testContext(root), {
      id: "r1:1",
      to: "AX-aaaa11",
    });

    await expect(reassignDismissed).rejects.toThrow(/--reinstate r1:1/);
  });

  it("refuses an unknown critique id, pointing at the listing", async () => {
    const root = reassignProject();
    const { logger } = createCaptureLogger();

    const reassignUnknown = reassignCritiqueOrchestrator(testContext(root, logger), {
      id: "r9:9",
      to: "AX-aaaa11",
    });

    await expect(reassignUnknown).rejects.toThrow(/praxis eval critiques/);
  });

  it("refuses an axiom that is not active", async () => {
    const root = reassignProject();
    const { logger } = createCaptureLogger();

    const reassignToGhost = reassignCritiqueOrchestrator(testContext(root, logger), {
      id: "r1:1",
      to: "AX-000000",
    });

    await expect(reassignToGhost).rejects.toThrow(/No axiom "AX-000000"/);
  });
});
