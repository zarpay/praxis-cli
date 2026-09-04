import type { CalibrationExpectation, CalibrationVerdict } from "@/types.js";

import { errors } from "@/helpers/errors-helper.js";
import { hash8 } from "@/helpers/hash-helper.js";

/**
 * One frozen, human-adjudicated calibration case (06): the input a
 * reviewer is measured on, the spec it was adjudicated against, and the
 * adjudication itself (`expected.json`).
 *
 * A case directory freezes the spec as *content* (`spec.md`, decided
 * 2026-09-05): its hash is the spec reference 06 asks for, and running
 * the case needs the text anyway. A CalibrationCase that exists is a
 * valid case — every `expected.json` field is validated here, so no
 * consumer re-checks.
 */
export class CalibrationCase {
  readonly id: string;
  /** Absolute path of the frozen input file. */
  readonly inputPath: string;
  readonly inputContent: string;
  /** Absolute path of the frozen spec copy (spec.md). */
  readonly specPath: string;
  readonly specContent: string;
  readonly expectation: CalibrationExpectation;

  private constructor(fields: {
    id: string;
    inputPath: string;
    inputContent: string;
    specPath: string;
    specContent: string;
    expectation: CalibrationExpectation;
  }) {
    this.id = fields.id;
    this.inputPath = fields.inputPath;
    this.inputContent = fields.inputContent;
    this.specPath = fields.specPath;
    this.specContent = fields.specContent;
    this.expectation = fields.expectation;
  }

  /**
   * Pure construction from already-loaded parts.
   *
   * @throws PraxisError when expected.json is malformed
   */
  static fromParts(fields: {
    id: string;
    inputPath: string;
    inputContent: string;
    specPath: string;
    specContent: string;
    expectedJson: string;
  }): CalibrationCase {
    const expectation = parseExpectation(fields.id, fields.expectedJson);

    return new CalibrationCase({ ...fields, expectation });
  }

  /** Provenance hash of the frozen input. */
  inputContentHash(): string {
    return hash8(this.inputContent);
  }

  /** The spec reference: the frozen spec content's hash (06). */
  specContentHash(): string {
    return hash8(this.specContent);
  }

  /** This case's contribution to the case-set hash. */
  identityInput(): string {
    return `${this.id}:${this.inputContentHash()}:${this.specContentHash()}`;
  }

  /** Every axiom the adjudication mentions, expected and forbidden. */
  axiomIds(): string[] {
    const expected = this.expectation.expected_violations.map((entry) => entry.axiom_id);
    const forbidden = this.expectation.forbidden_violations.map((entry) => entry.axiom_id);

    return [...new Set([...expected, ...forbidden])].sort();
  }
}

const CALIBRATION_VERDICTS: CalibrationVerdict[] = ["pass", "warn", "fail"];

/**
 * Validates expected.json field by field (06's exact list, plus the
 * flagged `spec_path` addition), so a malformed adjudication names its
 * own problem instead of surfacing as a scoring anomaly.
 *
 * @throws PraxisError naming the case and the field
 */
function parseExpectation(caseId: string, expectedJson: string): CalibrationExpectation {
  let raw: Record<string, unknown>;

  try {
    raw = JSON.parse(expectedJson) as Record<string, unknown>;
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);

    throw errors.invalidCalibrationCase(caseId, `expected.json is not valid JSON (${reason})`);
  }

  const verdict = raw["verdict"];

  if (
    typeof verdict !== "string" ||
    !CALIBRATION_VERDICTS.includes(verdict as CalibrationVerdict)
  ) {
    throw errors.invalidCalibrationCase(caseId, `"verdict" must be one of pass | warn | fail`);
  }

  for (const field of ["spec_path", "adjudicated_by", "adjudicated_on", "rationale"]) {
    if (typeof raw[field] !== "string" || raw[field] === "") {
      throw errors.invalidCalibrationCase(caseId, `"${field}" must be a non-empty string`);
    }
  }

  return {
    verdict: verdict as CalibrationVerdict,
    expected_violations: axiomEntries(caseId, raw, "expected_violations", "must_flag"),
    forbidden_violations: axiomEntries(caseId, raw, "forbidden_violations", "must_not_flag"),
    spec_path: raw["spec_path"] as string,
    adjudicated_by: raw["adjudicated_by"] as string,
    adjudicated_on: raw["adjudicated_on"] as string,
    rationale: raw["rationale"] as string,
  };
}

/** One violation list, each entry validated to carry its axiom id. */
function axiomEntries<Marker extends string>(
  caseId: string,
  raw: Record<string, unknown>,
  field: string,
  marker: Marker,
): ({ axiom_id: string } & Record<Marker, true>)[] {
  const list = raw[field] ?? [];

  if (!Array.isArray(list)) {
    throw errors.invalidCalibrationCase(caseId, `"${field}" must be an array`);
  }

  return list.map((entry: unknown) => {
    const axiomId = (entry as Record<string, unknown>)?.["axiom_id"];

    if (typeof axiomId !== "string" || axiomId === "") {
      throw errors.invalidCalibrationCase(caseId, `every "${field}" entry needs an "axiom_id"`);
    }

    return { axiom_id: axiomId, [marker]: true } as { axiom_id: string } & Record<Marker, true>;
  });
}
