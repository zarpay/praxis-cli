import { describe, expect, it } from "vitest";

import { CalibrationCase } from "@/models/calibration-case.js";
import { expectationJson } from "@tests/helpers/calibration-cases.js";

/** Constructs a case from literals, overriding only what a test varies. */
function buildCase(overrides: { expectedJson?: string } = {}): CalibrationCase {
  return CalibrationCase.fromParts({
    id: "case-1",
    inputPath: "/p/.praxis/calibration/cases/case-1/input.ts",
    inputContent: 'return err("invalid");',
    specPath: "/p/.praxis/calibration/cases/case-1/spec.md",
    specContent: "# Services\n\nError messages name the fix.\n",
    expectedJson: overrides.expectedJson ?? expectationJson(),
  });
}

describe("CalibrationCase", () => {
  it("constructs from valid parts and exposes the adjudication", () => {
    const calibrationCase = buildCase();

    expect(calibrationCase.expectation.verdict).toBe("fail");
    expect(calibrationCase.expectation.spec_path).toBe("src/services/README.md");
    expect(calibrationCase.expectation.expected_violations).toEqual([
      { axiom_id: "AX-b951db", must_flag: true },
    ]);
  });

  it("hashes input and spec separately, and identityInput carries both", () => {
    const calibrationCase = buildCase();
    const identity = calibrationCase.identityInput();

    expect(identity).toBe(
      `case-1:${calibrationCase.inputContentHash()}:${calibrationCase.specContentHash()}`,
    );
    expect(calibrationCase.inputContentHash()).not.toBe(calibrationCase.specContentHash());
  });

  it("axiomIds unions expected and forbidden, deduplicated and sorted", () => {
    const expectedJson = expectationJson({
      expected_violations: [{ axiom_id: "AX-zz", must_flag: true }],
      forbidden_violations: [
        { axiom_id: "AX-aa", must_not_flag: true },
        { axiom_id: "AX-zz", must_not_flag: true },
      ],
    });
    const calibrationCase = buildCase({ expectedJson });

    expect(calibrationCase.axiomIds()).toEqual(["AX-aa", "AX-zz"]);
  });

  it("rejects invalid JSON, naming the case", () => {
    const build = () => buildCase({ expectedJson: "{ not json" });

    expect(build).toThrow('Calibration case "case-1"');
    expect(build).toThrow("not valid JSON");
  });

  it("rejects an unknown verdict", () => {
    const expectedJson = expectationJson().replace('"fail"', '"maybe"');
    const build = () => buildCase({ expectedJson });

    expect(build).toThrow("pass | warn | fail");
  });

  it("rejects a violation entry without an axiom_id", () => {
    const expectedJson = expectationJson({
      expected_violations: [
        { must_flag: true } as unknown as { axiom_id: string; must_flag: true },
      ],
    });
    const build = () => buildCase({ expectedJson });

    expect(build).toThrow('every "expected_violations" entry needs an "axiom_id"');
  });

  it("rejects a missing adjudication field", () => {
    const expectedJson = expectationJson({ rationale: "" });
    const build = () => buildCase({ expectedJson });

    expect(build).toThrow('"rationale" must be a non-empty string');
  });
});
