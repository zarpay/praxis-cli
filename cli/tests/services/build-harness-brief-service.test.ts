import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import buildHarnessBriefService from "@/services/build-harness-brief-service.js";
import resolveReportScopeService from "@/services/resolve-report-scope-service.js";
import { CalibrationStore } from "@/stores/calibration-store.js";
import { seedAxiom } from "@tests/helpers/axiom-fixtures.js";
import { calibrationRecord } from "@tests/helpers/calibration-cases.js";
import { critiqueLine, seedLedgerRun } from "@tests/helpers/ledger-runs.js";
import { testConfig } from "@tests/helpers/test-config.js";

const AXIOM = "AX-aaaa11";
const QUIET_AXIOM = "AX-be9999";

describe("buildHarnessBriefService", () => {
  let root: string;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-brief-test-${randomUUID()}`);
    mkdirSync(root, { recursive: true });
    seedAxiom(root, AXIOM, { grounded_in: "docs/README.md#x" });
    seedAxiom(root, QUIET_AXIOM, { grounded_in: "docs/README.md#y" });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /** A diff run with introduced/resolved flow lines for the loud axiom. */
  function seedDiffRun(
    fields: { specUnits?: number; flows?: ("introduced" | "resolved")[] } = {},
  ): void {
    const flows = fields.flows ?? ["introduced", "resolved"];

    seedLedgerRun(root, {
      name: "flash",
      hash: "aaaa1111",
      runId: "d1",
      branch: "feature",
      scope: "diff",
      timestamp: "2026-09-05T10:00:00.000Z",
      specUnits: { "docs/README.md": fields.specUnits ?? 6 },
      diff: { head_sha: "0000000000000000000000000000000000000000" },
      extraLines: flows.map((flow, index) =>
        critiqueLine({
          runId: "d1",
          seq: index + 1,
          filePath: `docs/f${index}.md`,
          specPath: "docs/README.md",
          axiomId: AXIOM,
          axiomVersion: 1,
          flow,
        }),
      ),
    });
  }

  function brief() {
    const cfg = testConfig(root);
    const scoped = resolveReportScopeService(cfg, {});

    return buildHarnessBriefService(cfg, { scoped });
  }

  it("carries the 08-h skeleton: period, populations, calibration, residual, note", () => {
    seedDiffRun();

    const result = brief();

    expect(result.period.from).not.toBeNull();
    expect(result.populations).toEqual({ pre_spec: 0, post_spec: 0, unknown: 1 });
    expect(result.calibration).toContain("uncalibrated");
    expect(result.residual_summary).toContain("dismissed + rejected");
    expect(result.note).toContain("suggested, never verdicted");
  });

  it("an axiom below the floor is insufficient_data and recommends nothing", () => {
    seedDiffRun({ specUnits: 2 });

    const result = brief();
    const entry = result.top_axioms.find((candidate) => candidate.axiom_id === AXIOM);

    expect(entry?.suggested_diagnosis).toBe("insufficient_data");
    expect(entry?.diagnosis_reason).toContain("recommend nothing");
  });

  it("measured false positives route to reviewer_noise, not the harness", () => {
    seedDiffRun();
    const record = calibrationRecord({
      reviewer_name: "flash",
      axiom_scores: [
        {
          axiom_id: AXIOM,
          cases: 6,
          true_positives: 4,
          false_positives: 2,
          false_negatives: 0,
          variance: null,
        },
      ],
    });
    new CalibrationStore(testConfig(root)).writeRecord(record);

    // Population unknown keeps the rate at 0/6 = 0.0 — a computable rate.
    const result = brief();
    const entry = result.top_axioms.find((candidate) => candidate.axiom_id === AXIOM);

    expect(entry?.suggested_diagnosis).toBe("reviewer_noise");
    expect(entry?.diagnosis_reason).toContain("route to calibration");
  });

  it("resolution flow with a computable rate suggests harness_gap", () => {
    seedDiffRun();

    const result = brief();
    const entry = result.top_axioms.find((candidate) => candidate.axiom_id === AXIOM);

    expect(entry?.suggested_diagnosis).toBe("harness_gap");
    expect(entry?.trend).toBe("introduced 1 · resolved 1 · inherited 0 over the selected diffs");
  });

  it("active axioms with no evidence in scope are removal candidates", () => {
    seedDiffRun();

    const result = brief();

    expect(result.removal_candidates).toContain(QUIET_AXIOM);
    expect(result.removal_candidates).not.toContain(AXIOM);
  });

  it("representative critiques carry ledger ids and exclude resolved records", () => {
    seedDiffRun();

    const result = brief();
    const entry = result.top_axioms.find((candidate) => candidate.axiom_id === AXIOM);
    const ids = entry?.representative_critiques.map((critique) => critique.id);

    expect(ids).toEqual(["d1:1"]);
  });
});
