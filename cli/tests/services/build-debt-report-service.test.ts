import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import buildDebtReportService from "@/services/build-debt-report-service.js";
import { seedAxiom } from "@tests/helpers/axiom-fixtures.js";
import { critiqueLine, seedLedgerRun } from "@tests/helpers/ledger-runs.js";
import { testConfig } from "@tests/helpers/test-config.js";

/** One violation of the fixture axiom in one file. */
function violation(runId: string, seq: number, filePath: string): string {
  return critiqueLine({
    runId,
    seq,
    filePath,
    specPath: "docs/README.md",
    severity: "warning",
    axiomId: "AX-aaaa11",
    axiomVersion: 1,
  });
}

describe("buildDebtReportService", () => {
  let root: string;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-debt-test-${randomUUID()}`);
    mkdirSync(root, { recursive: true });
    seedAxiom(root, "AX-aaaa11", { severity: "warning", grounded_in: "docs/README.md#titles" });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("reports nothing without a baselined epoch", () => {
    seedLedgerRun(root, { name: "flash", hash: "aaaa1111", runId: "r1" });

    const report = buildDebtReportService(testConfig(root), {});

    expect(report.rows).toEqual([]);
  });

  it("computes stock, paydown, and appearances between baseline and latest", () => {
    seedLedgerRun(root, {
      name: "flash",
      hash: "aaaa1111",
      runId: "r1",
      baseline: true,
      timestamp: "2026-09-01T10:00:00.000Z",
      extraLines: [violation("r1", 1, "docs/a.md"), violation("r1", 2, "docs/b.md")],
    });
    seedLedgerRun(root, {
      name: "flash",
      hash: "aaaa1111",
      runId: "r2",
      timestamp: "2026-09-02T10:00:00.000Z",
      extraLines: [violation("r2", 1, "docs/b.md"), violation("r2", 2, "docs/c.md")],
    });

    const row = buildDebtReportService(testConfig(root), {}).rows[0];

    expect(row).toMatchObject({
      axiomId: "AX-aaaa11",
      reviewerName: "flash",
      baselineStock: 2,
      currentStock: 2,
      paydown: 1,
      appearedSinceBaseline: 1,
    });
  });

  it("an all-hit run never moves the evidence anchor — hits restate no critiques (05)", () => {
    seedLedgerRun(root, {
      name: "flash",
      hash: "aaaa1111",
      runId: "r1",
      baseline: true,
      timestamp: "2026-09-01T10:00:00.000Z",
      extraLines: [violation("r1", 1, "docs/a.md"), violation("r1", 2, "docs/b.md")],
    });
    seedLedgerRun(root, {
      name: "flash",
      hash: "aaaa1111",
      runId: "r2",
      timestamp: "2026-09-02T10:00:00.000Z",
      extraLines: [violation("r2", 1, "docs/b.md")],
    });
    seedLedgerRun(root, {
      name: "flash",
      hash: "aaaa1111",
      runId: "r3",
      timestamp: "2026-09-03T10:00:00.000Z",
      cacheMisses: 0,
      cacheHits: 2,
    });

    const report = buildDebtReportService(testConfig(root), {});

    // Current stock stays anchored to r2, the last run with fresh evidence.
    expect(report.rows[0]).toMatchObject({ baselineStock: 2, currentStock: 1, paydown: 1 });
    expect(report.evidence).toEqual([
      {
        reviewerName: "flash",
        baselineAt: "2026-09-01T10:00:00.000Z",
        currentAt: "2026-09-02T10:00:00.000Z",
      },
    ]);
  });

  it("notes missing credit when runs are unanchored — never guesses authors", () => {
    seedLedgerRun(root, {
      name: "flash",
      hash: "aaaa1111",
      runId: "r1",
      baseline: true,
      timestamp: "2026-09-01T10:00:00.000Z",
      extraLines: [violation("r1", 1, "docs/a.md")],
    });
    seedLedgerRun(root, {
      name: "flash",
      hash: "aaaa1111",
      runId: "r2",
      timestamp: "2026-09-02T10:00:00.000Z",
    });

    const report = buildDebtReportService(testConfig(root), {});

    expect(report.rows[0].paydown).toBe(1);
    expect(report.credits).toEqual([]);
    expect(report.creditNote).toContain("not anchored");
  });

  it("credits paydown to the authors who touched the file between anchored runs", () => {
    const env = { cwd: root, encoding: "utf8" as const };
    execFileSync("git", ["init", "-q", "-b", "main"], env);
    execFileSync("git", ["config", "user.email", "t@example.com"], env);
    execFileSync("git", ["config", "user.name", "Baseline Author"], env);
    mkdirSync(join(root, "docs"), { recursive: true });
    writeFileSync(join(root, "docs", "a.md"), "# Vague\n");
    execFileSync("git", ["add", "-A"], env);
    execFileSync("git", ["commit", "-qm", "before"], env);
    const fromSha = execFileSync("git", ["rev-parse", "HEAD"], env).trim();
    writeFileSync(join(root, "docs", "a.md"), "# A precise title\n");
    execFileSync("git", ["add", "-A"], env);
    execFileSync(
      "git",
      ["-c", "user.name=Fixer", "-c", "user.email=f@example.com", "commit", "-qm", "fix"],
      env,
    );
    const toSha = execFileSync("git", ["rev-parse", "HEAD"], env).trim();

    seedLedgerRun(root, {
      name: "flash",
      hash: "aaaa1111",
      runId: "r1",
      baseline: true,
      commitSha: fromSha,
      timestamp: "2026-09-01T10:00:00.000Z",
      extraLines: [violation("r1", 1, "docs/a.md")],
    });
    seedLedgerRun(root, {
      name: "flash",
      hash: "aaaa1111",
      runId: "r2",
      commitSha: toSha,
      timestamp: "2026-09-02T10:00:00.000Z",
    });

    const report = buildDebtReportService(testConfig(root), {});

    expect(report.credits).toEqual([{ author: "Fixer", resolved: 1 }]);
    expect(report.creditNote).toBeNull();
  });

  it("dedupes two critiques of one axiom in one file to one violation", () => {
    seedLedgerRun(root, {
      name: "flash",
      hash: "aaaa1111",
      runId: "r1",
      baseline: true,
      extraLines: [violation("r1", 1, "docs/a.md"), violation("r1", 2, "docs/a.md")],
    });

    const row = buildDebtReportService(testConfig(root), {}).rows[0];

    expect(row.baselineStock).toBe(1);
  });

  it("names the boundary in the re-baseline delta across two epochs", () => {
    seedLedgerRun(root, {
      name: "flash",
      hash: "aaaa1111",
      runId: "r1",
      baseline: true,
      timestamp: "2026-09-01T10:00:00.000Z",
      extraLines: [violation("r1", 1, "docs/a.md"), violation("r1", 2, "docs/b.md")],
    });
    seedLedgerRun(root, {
      name: "flash",
      hash: "bbbb2222",
      model: "new/model",
      runId: "r2",
      baseline: true,
      timestamp: "2026-09-02T10:00:00.000Z",
      extraLines: [violation("r2", 1, "docs/a.md")],
    });

    const report = buildDebtReportService(testConfig(root), {});

    expect(report.rebaseline).toEqual({
      boundaryLabel: "model → new/model",
      before: 2,
      after: 1,
    });
  });
});
