import type { ReviewerConfig } from "@/types.js";

import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Reviewer } from "@/models/reviewer.js";
import detectEpochBoundariesService from "@/services/detect-epoch-boundaries-service.js";
import { seedLedgerRun } from "@tests/helpers/ledger-runs.js";
import { testConfig } from "@tests/helpers/test-config.js";

const FLASH: ReviewerConfig = { name: "flash", model: "some/model", apiKeyEnvVar: "KEY" };

/** The hash the reviewer would write to the ledger today. */
function currentHash(config: ReviewerConfig): string {
  return Reviewer.fromConfig(config).cacheIdentity().hash;
}

describe("detectEpochBoundariesService", () => {
  let root: string;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-epoch-test-${randomUUID()}`);
    mkdirSync(root, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("finds no boundary in an empty ledger — bootstrap is not a change", () => {
    const boundaries = detectEpochBoundariesService(testConfig(root), { reviewers: [FLASH] });

    expect(boundaries).toEqual([]);
  });

  it("finds no boundary when the current hash has run before", () => {
    seedLedgerRun(root, { name: "flash", hash: currentHash(FLASH) });

    const boundaries = detectEpochBoundariesService(testConfig(root), { reviewers: [FLASH] });

    expect(boundaries).toEqual([]);
  });

  it("finds a boundary when the reviewer has history and its hash is new", () => {
    seedLedgerRun(root, { name: "flash", hash: "00000000" });

    const boundaries = detectEpochBoundariesService(testConfig(root), { reviewers: [FLASH] });

    expect(boundaries).toHaveLength(1);
    expect(boundaries[0].reviewerName).toBe("flash");
    expect(boundaries[0].previousHash).toBe("00000000");
    expect(boundaries[0].currentHash).toBe(currentHash(FLASH));
  });

  it("stays silent when known hashes interleave — contributors are not boundaries", () => {
    const known = currentHash(FLASH);
    seedLedgerRun(root, { name: "flash", hash: known, timestamp: "2026-09-01T09:00:00.000Z" });
    seedLedgerRun(root, { name: "flash", hash: "00000000", timestamp: "2026-09-01T10:00:00.000Z" });
    seedLedgerRun(root, { name: "flash", hash: known, timestamp: "2026-09-01T11:00:00.000Z" });

    const boundaries = detectEpochBoundariesService(testConfig(root), { reviewers: [FLASH] });

    expect(boundaries).toEqual([]);
  });

  it("treats a brand-new reviewer beside an incumbent as bootstrap, not a boundary", () => {
    const newcomer: ReviewerConfig = { name: "v32", model: "other/model", apiKeyEnvVar: "KEY" };
    seedLedgerRun(root, { name: "flash", hash: currentHash(FLASH) });

    const boundaries = detectEpochBoundariesService(testConfig(root), {
      reviewers: [FLASH, newcomer],
    });

    expect(boundaries).toEqual([]);
  });

  it("names the boundary from the most recent prior run", () => {
    seedLedgerRun(root, {
      name: "flash",
      hash: "00000000",
      model: "old/model",
      timestamp: "2026-08-01T00:00:00.000Z",
    });
    seedLedgerRun(root, {
      name: "flash",
      hash: "11111111",
      model: "older/model",
      timestamp: "2026-07-01T00:00:00.000Z",
    });

    const boundaries = detectEpochBoundariesService(testConfig(root), { reviewers: [FLASH] });

    expect(boundaries[0].previousHash).toBe("00000000");
    expect(boundaries[0].previousModel).toBe("old/model");
    expect(boundaries[0].lastRunTimestamp).toBe("2026-08-01T00:00:00.000Z");
  });
});
