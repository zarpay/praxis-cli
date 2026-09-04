import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import deriveFlowMetricsService from "@/services/derive-flow-metrics-service.js";
import resolveReportScopeService from "@/services/resolve-report-scope-service.js";
import { CalibrationStore } from "@/stores/calibration-store.js";
import { seedAxiom } from "@tests/helpers/axiom-fixtures.js";
import { calibrationRecord } from "@tests/helpers/calibration-cases.js";
import { critiqueLine, seedLedgerRun } from "@tests/helpers/ledger-runs.js";
import { testConfig } from "@tests/helpers/test-config.js";

/** Runs git quietly in the test repo. */
function git(root: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

describe("deriveFlowMetricsService", () => {
  let root: string;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-flow-test-${randomUUID()}`);
    mkdirSync(root, { recursive: true });
    seedAxiom(root, "AX-aaaa11", { grounded_in: "docs/README.md#x" });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /** A diff run on a branch, with flow-labeled critique lines. */
  function seedDiffRun(fields: {
    runId: string;
    branch: string;
    timestamp: string;
    hash?: string;
    headSha?: string;
    specUnits?: Record<string, number>;
    lines?: string[];
  }): void {
    seedLedgerRun(root, {
      name: "flash",
      hash: fields.hash ?? "aaaa1111",
      runId: fields.runId,
      branch: fields.branch,
      scope: "diff",
      timestamp: fields.timestamp,
      specUnits: fields.specUnits ?? { "docs/README.md": 6 },
      diff: { head_sha: fields.headSha ?? "0000000000000000000000000000000000000000" },
      extraLines: fields.lines ?? [],
    });
  }

  /** The flow line factory for this suite's axiom. */
  function flowLine(runId: string, seq: number, flow: "introduced" | "resolved" | "inherited") {
    return critiqueLine({
      runId,
      seq,
      filePath: `docs/f${seq}.md`,
      specPath: "docs/README.md",
      axiomId: "AX-aaaa11",
      axiomVersion: 1,
      flow,
    });
  }

  function report() {
    const cfg = testConfig(root);
    const scoped = resolveReportScopeService(cfg, {});

    return deriveFlowMetricsService(cfg, { scoped });
  }

  it("is null when the scope holds no diff runs", () => {
    seedLedgerRun(root, { name: "flash", hash: "aaaa1111", runId: "r1", scope: "corpus" });

    expect(report()).toBeNull();
  });

  it("counts introduced, resolved, and inherited per axiom per reviewer", () => {
    seedDiffRun({
      runId: "d1",
      branch: "feature",
      timestamp: "2026-09-04T10:00:00.000Z",
      lines: [
        flowLine("d1", 1, "introduced"),
        flowLine("d1", 2, "inherited"),
        flowLine("d1", 3, "resolved"),
      ],
    });

    const flow = report();

    expect(flow?.rows).toHaveLength(1);
    expect(flow?.rows[0]).toMatchObject({
      axiomId: "AX-aaaa11",
      reviewerName: "flash",
      introduced: 1,
      resolved: 1,
      inherited: 1,
    });
    // The head sha never existed in this (non-git) tmpdir, so the
    // population is unknown — never guessed — and the post-spec rate
    // counts nothing.
    expect(flow?.rows[0].introducedByPopulation).toEqual({
      pre_spec: 0,
      post_spec: 0,
      unknown: 1,
    });
    expect(flow?.rows[0].introductionRate.display).toContain("0/6");
  });

  it("suppresses an introduction at or below the reviewer's measured noise floor (01, 06-s)", () => {
    git(root, "init", "-q", "-b", "main");
    git(root, "config", "user.email", "t@example.com");
    git(root, "config", "user.name", "T");
    git(root, "commit", "-qm", "base", "--allow-empty");
    const headSha = git(root, "rev-parse", "HEAD");

    seedDiffRun({
      runId: "d1",
      branch: "feature",
      timestamp: "2026-09-05T10:00:00.000Z",
      headSha,
      lines: [flowLine("d1", 1, "introduced")],
    });

    const record = calibrationRecord({
      reviewer_name: "flash",
      axiom_scores: [
        {
          axiom_id: "AX-aaaa11",
          cases: 6,
          true_positives: 5,
          false_positives: 1,
          false_negatives: 1,
          variance: 2,
        },
      ],
    });
    new CalibrationStore(testConfig(root)).writeRecord(record);

    const flow = report();

    expect(flow?.rows[0].introducedByPopulation.post_spec).toBe(1);
    expect(flow?.rows[0].introductionRate.display).toContain("below reviewer noise floor");
    expect(flow?.rows[0].introductionRate.rate).toBeNull();
  });

  it("reruns replace the picture: only the newest diff run per branch counts (12)", () => {
    seedDiffRun({
      runId: "d1",
      branch: "feature",
      timestamp: "2026-09-04T10:00:00.000Z",
      lines: [flowLine("d1", 1, "introduced"), flowLine("d1", 2, "introduced")],
    });
    seedDiffRun({
      runId: "d2",
      branch: "feature",
      timestamp: "2026-09-04T11:00:00.000Z",
      lines: [flowLine("d2", 1, "introduced")],
    });

    const flow = report();

    expect(flow?.runsConsidered).toBe(1);
    expect(flow?.rows[0].introduced).toBe(1);
  });

  it("never sums across an epoch boundary: only the current hash's runs count (07 rule 6)", () => {
    seedDiffRun({
      runId: "d1",
      branch: "old-work",
      timestamp: "2026-09-01T10:00:00.000Z",
      hash: "aaaa1111",
      lines: [flowLine("d1", 1, "introduced")],
    });
    // A model swap opens a new epoch; the old branch's flow is another
    // instrument's reading.
    seedLedgerRun(root, {
      name: "flash",
      hash: "bbbb2222",
      runId: "r-new",
      scope: "corpus",
      timestamp: "2026-09-02T10:00:00.000Z",
      baseline: true,
    });
    seedDiffRun({
      runId: "d2",
      branch: "new-work",
      timestamp: "2026-09-03T10:00:00.000Z",
      hash: "bbbb2222",
      lines: [flowLine("d2", 1, "introduced")],
    });

    const flow = report();

    expect(flow?.runsConsidered).toBe(1);
    expect(flow?.rows[0].introduced).toBe(1);
  });

  it("suppresses the rate below the small-n floor (07 rule 3)", () => {
    seedDiffRun({
      runId: "d1",
      branch: "feature",
      timestamp: "2026-09-04T10:00:00.000Z",
      specUnits: { "docs/README.md": 2 },
      lines: [flowLine("d1", 1, "introduced")],
    });

    expect(report()?.rows[0].introductionRate.display).toContain("insufficient data");
  });
});
