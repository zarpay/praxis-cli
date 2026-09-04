import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import buildAxiomReportService from "@/services/build-axiom-report-service.js";
import resolveReportScopeService from "@/services/resolve-report-scope-service.js";
import { CalibrationStore } from "@/stores/calibration-store.js";
import { seedAxiom } from "@tests/helpers/axiom-fixtures.js";
import { calibrationRecord } from "@tests/helpers/calibration-cases.js";
import { critiqueLine, seedLedgerRun } from "@tests/helpers/ledger-runs.js";
import { testConfig } from "@tests/helpers/test-config.js";

const AXIOM = "AX-aaaa11";

describe("buildAxiomReportService", () => {
  let root: string;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-axiom-report-test-${randomUUID()}`);
    mkdirSync(root, { recursive: true });
    seedAxiom(root, AXIOM, { grounded_in: "docs/README.md#x" });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /** One run with critiques on this axiom from one reviewer. */
  function seedRun(runId: string, reviewerName: string, files: string[]): void {
    seedLedgerRun(root, {
      name: reviewerName,
      hash: `${reviewerName}-hash`,
      runId,
      scope: "corpus",
      extraLines: files.map((filePath, index) =>
        critiqueLine({
          runId,
          seq: index + 1,
          filePath,
          specPath: "docs/README.md",
          axiomId: AXIOM,
          axiomVersion: 1,
          reviewer: reviewerName,
        }),
      ),
    });
  }

  function buildReport(reviewers: { name: string }[]) {
    const cfg = testConfig(root, {
      reviewers: reviewers.map((reviewer) => ({
        name: reviewer.name,
        model: "m",
        apiKeyEnvVar: "K",
      })),
    });
    const scoped = resolveReportScopeService(cfg, {});

    return buildAxiomReportService(cfg, { scoped, axiomId: AXIOM });
  }

  it("agreement is null with one reviewer — nothing to corroborate", () => {
    seedRun("r1", "flash", ["docs/a.md"]);

    const report = buildReport([{ name: "flash" }]);

    expect(report.agreement).toBeNull();
  });

  it("counts corroborated and single-witness files across reviewers (06-p)", () => {
    seedRun("r1", "flash", ["docs/a.md", "docs/b.md"]);
    seedRun("r2", "v32", ["docs/a.md"]);

    const report = buildReport([{ name: "flash" }, { name: "v32" }]);

    expect(report.agreement).toEqual({ corroborated: 1, disagreed: 1 });
  });

  it("names calibration drift when a reviewer's latest record flags the axiom", () => {
    seedRun("r1", "flash", ["docs/a.md"]);
    const record = calibrationRecord({
      reviewer_name: "flash",
      timestamp: "2026-09-05T00:00:00.000Z",
      drift_flagged: [AXIOM],
    });
    new CalibrationStore(testConfig(root)).writeRecord(record);

    const report = buildReport([{ name: "flash" }]);

    expect(report.driftNote).toContain("calibration drift flagged by flash at 2026-09-05");
    expect(report.driftNote).toContain("not comparable");
  });

  it("driftNote is null when nothing was flagged", () => {
    seedRun("r1", "flash", ["docs/a.md"]);

    const report = buildReport([{ name: "flash" }]);

    expect(report.driftNote).toBeNull();
  });
});
