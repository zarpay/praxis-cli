import type { CalibrationExpectation, LedgerCalibrationRecord } from "@/types.js";

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** A valid expected.json, overriding only what the test cares about. */
export function expectationJson(overrides: Partial<CalibrationExpectation> = {}): string {
  const expectation: CalibrationExpectation = {
    verdict: "fail",
    expected_violations: [{ axiom_id: "AX-b951db", must_flag: true }],
    forbidden_violations: [],
    spec_path: "src/services/README.md",
    adjudicated_by: "sebastian",
    adjudicated_on: "2026-09-05",
    rationale: "the error message names neither the problem nor the fix",
    ...overrides,
  };

  return JSON.stringify(expectation, null, 2);
}

/**
 * Seeds one case directory under `<root>/.praxis/calibration/cases/`:
 * one input file, the frozen spec, and expected.json.
 */
export function seedCase(
  root: string,
  id: string,
  overrides: {
    inputName?: string;
    inputContent?: string;
    specContent?: string;
    expectedJson?: string;
  } = {},
): string {
  const caseDir = join(root, ".praxis", "calibration", "cases", id);

  mkdirSync(caseDir, { recursive: true });
  writeFileSync(join(caseDir, overrides.inputName ?? "input.ts"), overrides.inputContent ?? "code");
  writeFileSync(join(caseDir, "spec.md"), overrides.specContent ?? "# Spec\n\nStandards.\n");
  writeFileSync(join(caseDir, "expected.json"), overrides.expectedJson ?? expectationJson());

  return caseDir;
}

/** A valid calibration record, overriding only what the test cares about. */
export function calibrationRecord(
  overrides: Partial<LedgerCalibrationRecord> = {},
): LedgerCalibrationRecord {
  return {
    kind: "calibration",
    calibration_id: "20260905T000000000Z-00000000",
    timestamp: "2026-09-05T00:00:00.000Z",
    commit_sha: null,
    branch: null,
    reviewer_name: "v32",
    reviewer_model: "deepseek/deepseek-v3.2",
    reviewer_hash: "abcd1234",
    case_count: 1,
    case_set_hash: "cafe0000",
    checklist_hash: "feed0000",
    repeats: 1,
    verdict_matches: 1,
    unverified_count: 0,
    false_positive_count: 0,
    axiom_scores: [],
    drift_flagged: [],
    prompt_tokens: null,
    completion_tokens: null,
    cost_usd: null,
    ...overrides,
  };
}
