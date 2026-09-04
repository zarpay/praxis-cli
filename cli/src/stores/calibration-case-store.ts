import type { PraxisConfig } from "@/models/praxis-config.js";
import type { StoreProblem } from "@/types.js";

import { errors } from "@/helpers/errors-helper.js";
import { exists, listDirs, listFilesRecursive, readText } from "@/helpers/files-helper.js";
import { hash8 } from "@/helpers/hash-helper.js";
import { joinPath } from "@/helpers/paths-helper.js";
import { CalibrationCase } from "@/models/calibration-case.js";

/**
 * The frozen calibration cases: `.praxis/calibration/cases/<id>/`,
 * found and read, never written (10 — cases are human-adjudicated,
 * hand-edited, reviewed in PRs; SpecStore's posture).
 *
 * A case directory holds exactly three things: one input file, the
 * frozen spec as `spec.md`, and `expected.json`. The layout knowledge
 * lives here; the document format is `CalibrationCase`.
 */
export class CalibrationCaseStore {
  private readonly casesDir: string;

  constructor(cfg: PraxisConfig) {
    this.casesDir = joinPath(cfg.root, ".praxis", "calibration", "cases");
  }

  /** Every case parsed, sweep-tolerant: one bad directory never kills the set. */
  all(): { cases: CalibrationCase[]; problems: StoreProblem[] } {
    const cases: CalibrationCase[] = [];
    const problems: StoreProblem[] = [];

    if (!exists(this.casesDir)) return { cases, problems };

    for (const id of listDirs(this.casesDir)) {
      const caseDir = joinPath(this.casesDir, id);

      try {
        cases.push(this.read(id));
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);

        problems.push({ path: caseDir, message });
      }
    }

    return { cases, problems };
  }

  /**
   * One case directory, parse-hard.
   *
   * @throws PraxisError when the directory or expected.json is malformed
   */
  read(id: string): CalibrationCase {
    const caseDir = joinPath(this.casesDir, id);
    const files = listFilesRecursive(caseDir);
    const inputs = files.filter((name) => name !== "spec.md" && name !== "expected.json");

    if (!files.includes("expected.json")) {
      throw errors.invalidCalibrationCase(id, "expected.json is missing");
    }

    if (!files.includes("spec.md")) {
      throw errors.invalidCalibrationCase(id, "the frozen spec (spec.md) is missing");
    }

    if (inputs.length !== 1) {
      throw errors.invalidCalibrationCase(
        id,
        `expected exactly one input file, found ${inputs.length}`,
      );
    }

    const inputPath = joinPath(caseDir, inputs[0]);
    const specPath = joinPath(caseDir, "spec.md");

    return CalibrationCase.fromParts({
      id,
      inputPath,
      inputContent: readText(inputPath),
      specPath,
      specContent: readText(specPath),
      expectedJson: readText(joinPath(caseDir, "expected.json")),
    });
  }

  /**
   * Hash over the sorted case identities — the staleness input beyond
   * the reviewer hash (06-g): any case added, removed, or edited
   * changes it, so a record proves which set it measured.
   */
  caseSetHash(): string {
    const identities = this.all().cases.map((currentCase) => currentCase.identityInput());

    return hash8(identities.sort().join("\n"));
  }
}
