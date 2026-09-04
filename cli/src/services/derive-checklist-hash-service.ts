import type { CalibrationCase } from "@/models/calibration-case.js";
import type { Service } from "@/types.js";

import { hash8 } from "@/helpers/hash-helper.js";
import { joinPath } from "@/helpers/paths-helper.js";
import { AxiomStore } from "@/stores/axiom-store.js";

/** The frozen cases whose live checklists are hashed. */
interface DeriveChecklistHashInput {
  cases: CalibrationCase[];
}

/**
 * Hash over the active checklists of every case's live spec (06, added
 * 2026-09-05 — found live): ratifying or versioning an axiom grounded
 * in a case's spec changes what the reviewer is asked on that case
 * without touching the case set or the reviewer hash. Recorded at
 * `calibrate run` and compared at status time — the third way the
 * instrument changes under you.
 */
const deriveChecklistHashService: Service<DeriveChecklistHashInput, string> = (cfg, { cases }) => {
  const specPaths = [...new Set(cases.map((currentCase) => currentCase.expectation.spec_path))];
  const store = new AxiomStore(cfg);

  const serialized = specPaths.sort().map((specPath) => {
    const checklist = store.checklistFor(joinPath(cfg.root, specPath));
    const entries = checklist.map((axiom) => `${axiom.id} v${axiom.version}\n${axiom.body}`);

    return `${specPath}\n${entries.join("\n")}`;
  });

  return hash8(serialized.join("\n\n"));
};

export default deriveChecklistHashService;
