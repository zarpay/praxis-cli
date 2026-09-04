import type { LedgerCalibrationRecord } from "@/types.js";

import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Reviewer } from "@/models/reviewer.js";
import deriveCalibrationStatusService from "@/services/derive-calibration-status-service.js";
import { CalibrationCaseStore } from "@/stores/calibration-case-store.js";
import { CalibrationStore } from "@/stores/calibration-store.js";
import { calibrationRecord, expectationJson, seedCase } from "@tests/helpers/calibration-cases.js";
import { TEST_REVIEWER } from "@tests/helpers/openrouter-msw.js";
import { testConfig } from "@tests/helpers/test-config.js";

const SPEC_CONTENT = "# Services\n\nError messages name the fix.\n";

describe("deriveCalibrationStatusService", () => {
  let root: string;
  const reviewer = Reviewer.fromConfig(TEST_REVIEWER);

  beforeEach(() => {
    root = join(tmpdir(), `praxis-calibration-status-test-${randomUUID()}`);
    mkdirSync(join(root, "src", "services"), { recursive: true });
    writeFileSync(join(root, "src", "services", "README.md"), SPEC_CONTENT);
    seedCase(root, "case-1", {
      specContent: SPEC_CONTENT,
      expectedJson: expectationJson({ spec_path: "src/services/README.md" }),
    });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /** Writes a record aligned with the live project, then applies overrides. */
  function seedRecord(overrides: Partial<LedgerCalibrationRecord> = {}): void {
    const cfg = testConfig(root);
    const aligned = calibrationRecord({
      reviewer_name: reviewer.name,
      reviewer_hash: reviewer.hash(),
      case_set_hash: new CalibrationCaseStore(cfg).caseSetHash(),
      ...overrides,
    });

    new CalibrationStore(cfg).writeRecord(aligned);
  }

  function derive() {
    return deriveCalibrationStatusService(testConfig(root), { reviewers: [reviewer] });
  }

  it("absent when no record exists for the reviewer", () => {
    const result = derive();

    expect(result.statuses[0].state).toBe("absent");
    expect(result.statuses[0].detail).toContain("praxis calibrate run");
    expect(result.anyStale).toBe(true);
  });

  it("calibrated when identity, case set, and live specs all match", () => {
    seedRecord();

    const result = derive();

    expect(result.statuses[0].state).toBe("calibrated");
    expect(result.statuses[0].lastCalibratedAt).not.toBeNull();
    expect(result.anyStale).toBe(false);
  });

  it("stale when the reviewer identity changed since the record", () => {
    seedRecord({ reviewer_hash: "an-older-identity" });

    const result = derive();

    expect(result.statuses[0].state).toBe("stale");
    expect(result.statuses[0].detail).toContain("reviewer identity changed");
  });

  it("stale when the case set changed since the record", () => {
    seedRecord();
    seedCase(root, "case-2", { specContent: SPEC_CONTENT });

    const result = derive();

    expect(result.statuses[0].state).toBe("stale");
    expect(result.statuses[0].detail).toContain("case set changed");
  });

  it("the banner marks non-calibrated reviewers uninterpretable, per reviewer (06-q)", () => {
    const result = derive();

    expect(result.banner).toBe("test: uninterpretable — recalibrate");
    expect(result.stamps).toEqual({ test: "uncalibrated" });
  });

  it("the banner names calibrated reviewers with their date, and stamps follow", () => {
    seedRecord({ timestamp: "2026-09-05T00:00:00.000Z" });

    const result = derive();

    expect(result.banner).toBe("test: calibrated 2026-09-05");
    expect(result.stamps).toEqual({ test: "calibrated" });
  });

  it("stale when a case's live spec no longer matches what it froze", () => {
    seedRecord();
    writeFileSync(join(root, "src", "services", "README.md"), "# Services\n\nRewritten.\n");

    const result = derive();

    expect(result.statuses[0].state).toBe("stale");
    expect(result.statuses[0].detail).toContain("src/services/README.md changed");
  });
});
