import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import buildOrientationService from "@/services/build-orientation-service.js";
import { seedAxiom } from "@tests/helpers/axiom-fixtures.js";
import { seedLedgerRun } from "@tests/helpers/ledger-runs.js";

describe("buildOrientationService", () => {
  let root: string;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-orientation-test-${randomUUID()}`);
    mkdirSync(root, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("orients an empty project honestly: no runs, nothing pending", () => {
    const orientation = buildOrientationService({ root });

    expect(orientation).toMatchObject({
      lastRun: null,
      pendingTriage: 0,
      proposalsPending: 0,
      activeAxioms: 0,
      debtLine: null,
    });
  });

  it("names the last run, its reviewer, and its anchoring", () => {
    seedLedgerRun(root, {
      name: "flash",
      hash: "aaaa1111",
      timestamp: "2026-09-01T10:00:00.000Z",
    });
    seedLedgerRun(root, {
      name: "v32",
      hash: "bbbb2222",
      timestamp: "2026-09-03T10:00:00.000Z",
      commitSha: "a".repeat(40),
    });

    const { lastRun } = buildOrientationService({ root });

    expect(lastRun).toEqual({
      at: "2026-09-03T10:00:00.000Z",
      reviewerName: "v32",
      anchored: true,
    });
  });

  it("counts axioms by lifecycle and reports the debt line per reviewer", () => {
    seedAxiom(root, "AX-aaaa11");
    seedAxiom(root, "AX-bbbb22", { status: "proposed", proposed: true });
    seedLedgerRun(root, { name: "flash", hash: "aaaa1111", failCount: 3 });

    const orientation = buildOrientationService({ root });

    expect(orientation.activeAxioms).toBe(1);
    expect(orientation.proposalsPending).toBe(1);
    expect(orientation.debtLine).toEqual([{ reviewerName: "flash", errors: 3 }]);
  });
});
