import type { TriageRecord } from "@/types.js";

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { reviewCritiquesOrchestrator } from "@/orchestrators/review-critiques-orchestrator.js";
import deriveTriageStateService from "@/services/derive-triage-state-service.js";
import joinCritiqueLabelsService from "@/services/join-critique-labels-service.js";
import { RunStore } from "@/stores/run-store.js";
import { TriageStore } from "@/stores/triage-store.js";
import { createCaptureLogger } from "@tests/helpers/capture-logger.js";
import { testContext } from "@tests/helpers/command-context.js";
import { critiqueLine, seedLedgerRun } from "@tests/helpers/ledger-runs.js";
import { testConfig } from "@tests/helpers/test-config.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

/** Two open critiques on the ledger. */
function reviewProject(): string {
  const { root, cleanup } = createValidatorTmpdir({
    sources: ["docs"],
    files: { "docs/README.md": "# Spec", "docs/guide.md": "# Guide" },
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
      critiqueLine({
        runId: "r1",
        seq: 2,
        filePath: "docs/guide.md",
        specPath: "docs/README.md",
        text: "Recommended an async queue.",
      }),
    ],
  });

  return root;
}

/** A triage session dated before anything the orchestrator will mint. */
function seedEarlierSession(root: string, records: TriageRecord[]): void {
  const dir = join(root, ".praxis", "ledger", "triage");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "20260101T000000000Z-00000000.jsonl"),
    records.map((record) => JSON.stringify(record)).join("\n") + "\n",
  );
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

describe("reviewCritiquesOrchestrator", () => {
  it("--dismiss records the validity judgment and removes the critique from every queue", async () => {
    const root = reviewProject();
    const { logger, output } = createCaptureLogger();

    const outcome = await reviewCritiquesOrchestrator(testContext(root, logger), {
      dismiss: "r1:2",
      reason: "the spec never forbids queues",
    });

    const records = triageRecords(root);
    const state = deriveTriageStateService(testConfig(root), {});

    expect(outcome).toBe("ok");
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      kind: "dismissal",
      critique_id: "r1:2",
      reason: "the spec never forbids queues",
    });
    expect(state.pending.map((critique) => critique.id)).toEqual(["r1:1"]);
    expect(state.dismissed).toBe(1);
    expect(output()).toContain("r1:2 dismissed");
  });

  it("--reinstate lifts a dismissal; the critique is evidence again", async () => {
    const root = reviewProject();
    // Seeded under an id that sorts before anything minted now: the join
    // reads sessions in id order, and a same-millisecond mint would tie.
    seedEarlierSession(root, [
      { kind: "dismissal", critique_id: "r1:2", reason: "noise", timestamp: "t" },
    ]);
    const { logger } = createCaptureLogger();

    const outcome = await reviewCritiquesOrchestrator(testContext(root, logger), {
      reinstate: "r1:2",
      reason: "misread the spec",
    });

    const state = deriveTriageStateService(testConfig(root), {});

    expect(outcome).toBe("ok");
    expect(state.pending.map((critique) => critique.id)).toEqual(["r1:1", "r1:2"]);
    expect(state.dismissed).toBe(0);
  });

  it("--reinstate on a critique that is not dismissed writes nothing and fails", async () => {
    const root = reviewProject();
    const { logger, output } = createCaptureLogger();

    const outcome = await reviewCritiquesOrchestrator(testContext(root, logger), {
      reinstate: "r1:2",
      reason: "misread",
    });

    expect(outcome).toBe("failed");
    expect(triageRecords(root)).toEqual([]);
    expect(output()).toContain("not dismissed");
  });

  it("--dismiss without --reason is a usage error naming the fix", async () => {
    const root = reviewProject();

    const dismissWithoutReason = reviewCritiquesOrchestrator(testContext(root), {
      dismiss: "r1:2",
    });

    await expect(dismissWithoutReason).rejects.toThrow(/--dismiss needs --reason/);
  });

  it("dismisses a labeled critique — presumed valid, never final; the label stays beneath", async () => {
    const root = reviewProject();
    new TriageStore(testConfig(root)).writeSession([
      {
        kind: "assignment",
        critique_id: "r1:1",
        axiom_id: "AX-aaaa11",
        axiom_version: 1,
        assigned_by: { decision: "matcher", suggested_by: "m" },
        timestamp: "t",
      },
    ]);

    const outcome = await reviewCritiquesOrchestrator(testContext(root), {
      dismiss: "r1:1",
      reason: "the reviewer hallucinated this",
    });

    expect(outcome).toBe("ok");

    const records = triageRecords(root);
    expect(records).toHaveLength(2);
    expect(records[1]).toMatchObject({ kind: "dismissal", critique_id: "r1:1" });

    // The dismissal wins at read time; the assignment stays beneath it.
    const [labeled] = joinCritiqueLabelsService(testConfig(root), {
      critiques: new RunStore(testConfig(root)).critiques().filter((c) => c.id === "r1:1"),
    });
    expect(labeled?.axiom_id).toBeNull();
  });

  it("refuses an unknown critique id, pointing at the listing", async () => {
    const root = reviewProject();

    const dismissUnknown = reviewCritiquesOrchestrator(testContext(root), {
      dismiss: "r9:9",
      reason: "x",
    });

    await expect(dismissUnknown).rejects.toThrow(/praxis eval critiques/);
  });

  it("refuses to run interactively without a TTY, naming the flags", async () => {
    const root = reviewProject();

    const runWithoutTty = reviewCritiquesOrchestrator(testContext(root), {});

    await expect(runWithoutTty).rejects.toThrow(/--dismiss <critique-id> --reason/);
  });
});
