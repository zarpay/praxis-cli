import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PraxisConfig } from "@/models/praxis-config.js";
import buildEvalReportService from "@/services/build-eval-report-service.js";
import resolveReportScopeService from "@/services/resolve-report-scope-service.js";
import { seedAxiom } from "@tests/helpers/axiom-fixtures.js";
import { critiqueLine, seedLedgerRun } from "@tests/helpers/ledger-runs.js";

/** One matched critique line for the fixture axiom. */
function matchedCritique(runId: string, seq: number, filePath: string, reviewer: string): string {
  return critiqueLine({
    runId,
    seq,
    filePath,
    reviewer,
    specPath: "docs/README.md",
    severity: "warning",
    axiomId: "AX-aaaa11",
    axiomVersion: 1,
  });
}

describe("buildEvalReportService", () => {
  let root: string;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-eval-report-test-${randomUUID()}`);
    mkdirSync(join(root, ".praxis"), { recursive: true });
    seedAxiom(root, "AX-aaaa11", {
      severity: "warning",
      grounded_in: "docs/README.md#titles",
      introduced: "2026-08-01",
    });
    writeFileSync(join(root, ".praxis", "config.json"), JSON.stringify({ sources: ["docs"] }));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function report() {
    const cfg = new PraxisConfig(root);
    const scoped = resolveReportScopeService(cfg, {});

    return buildEvalReportService(cfg, { scoped });
  }

  it("carries the calibration banner unconditionally (rule 4)", () => {
    expect(report().calibration).toContain("uncalibrated");
  });

  it("keeps reviewers as separate series — never pooled (rule 7)", () => {
    seedLedgerRun(root, {
      name: "flash",
      hash: "aaaa1111",
      runId: "r1",
      specUnits: { "docs/README.md": 10 },
      extraLines: [matchedCritique("r1", 1, "docs/a.md", "flash")],
    });
    seedLedgerRun(root, {
      name: "v32",
      hash: "bbbb2222",
      runId: "r2",
      specUnits: { "docs/README.md": 10 },
      extraLines: [matchedCritique("r2", 1, "docs/a.md", "v32")],
    });

    const rows = report().axioms;
    const reviewers = rows.map((row) => row.reviewerName).sort();

    expect(rows).toHaveLength(2);
    expect(reviewers).toEqual(["flash", "v32"]);
  });

  it("anchors current stock to the latest evidenced corpus run — all-hit runs never move it", () => {
    seedLedgerRun(root, {
      name: "flash",
      hash: "aaaa1111",
      runId: "r1",
      timestamp: "2026-09-01T10:00:00.000Z",
      specUnits: { "docs/README.md": 10 },
      extraLines: [matchedCritique("r1", 1, "docs/a.md", "flash")],
    });
    seedLedgerRun(root, {
      name: "flash",
      hash: "aaaa1111",
      runId: "r2",
      timestamp: "2026-09-02T10:00:00.000Z",
      cacheMisses: 0,
      cacheHits: 10,
    });

    const row = report().axioms[0];

    expect(row.rate.numerator).toBe(1);
    expect(row.asOf).toBe("2026-09-01T10:00:00.000Z");
  });

  it("rates current stock against the run's own spec_units denominator (rule 3)", () => {
    seedLedgerRun(root, {
      name: "flash",
      hash: "aaaa1111",
      runId: "r1",
      specUnits: { "docs/README.md": 10 },
      extraLines: [
        matchedCritique("r1", 1, "docs/a.md", "flash"),
        matchedCritique("r1", 2, "docs/b.md", "flash"),
      ],
    });

    const row = report().axioms[0];

    expect(row.rate.display).toBe("2/10 (20.0%)");
  });

  it("suppresses a rate under the small-n floor, never printing a number", () => {
    seedLedgerRun(root, {
      name: "flash",
      hash: "aaaa1111",
      runId: "r1",
      specUnits: { "docs/README.md": 3 },
      extraLines: [matchedCritique("r1", 1, "docs/a.md", "flash")],
    });

    const row = report().axioms[0];

    expect(row.rate.rate).toBeNull();
    expect(row.rate.display).toContain("insufficient data");
  });

  it("qualifies critique counts by population — unknown outside git (rule 2)", () => {
    seedLedgerRun(root, {
      name: "flash",
      hash: "aaaa1111",
      runId: "r1",
      specUnits: { "docs/README.md": 10 },
      extraLines: [matchedCritique("r1", 1, "docs/a.md", "flash")],
    });

    const row = report().axioms[0];

    expect(row.byPopulation).toEqual({ pre_spec: 0, post_spec: 0, unknown: 1 });
  });

  it("segments an axiom's critiques by epoch, never summing across (rule 6)", () => {
    seedLedgerRun(root, {
      name: "flash",
      hash: "aaaa1111",
      runId: "r1",
      timestamp: "2026-09-01T10:00:00.000Z",
      specUnits: { "docs/README.md": 10 },
      extraLines: [matchedCritique("r1", 1, "docs/a.md", "flash")],
    });
    seedLedgerRun(root, {
      name: "flash",
      hash: "cccc3333",
      runId: "r2",
      timestamp: "2026-09-02T10:00:00.000Z",
      specUnits: { "docs/README.md": 10 },
      extraLines: [matchedCritique("r2", 1, "docs/a.md", "flash")],
    });

    const row = report().axioms[0];

    expect(row.segments).toHaveLength(2);
    expect(row.segments.map((segment) => segment.violations)).toEqual([1, 1]);
  });

  it("sums cost across scoped runs and reports null when nothing reported", () => {
    seedLedgerRun(root, { name: "flash", hash: "aaaa1111", runId: "r1", costUsd: 0.002 });
    seedLedgerRun(root, { name: "flash", hash: "aaaa1111", runId: "r2", costUsd: 0.003 });

    expect(report().panel.costUsd).toBeCloseTo(0.005);
  });
});
