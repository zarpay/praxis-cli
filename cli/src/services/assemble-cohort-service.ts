import type { EvalUnit, Service } from "@/types.js";

import { readText } from "@/helpers/files-helper.js";
import { relativePath } from "@/helpers/paths-helper.js";

/** The cohort to assemble, and the root its members are named against. */
interface AssembleCohortInput {
  unit: EvalUnit;
}

/**
 * A cohort's members as one review input, each labeled with its
 * project-relative path so critiques can locate their file.
 *
 * Shared rather than duplicated because the exact text is part of the
 * content hash: two callers assembling a cohort even slightly
 * differently would key the same review to two different cache entries
 * and split its evidence in the ledger.
 */
const assembleCohortService: Service<AssembleCohortInput, string> = (cfg, { unit }) => {
  return unit.files
    .map((file) => `===== FILE: ${relativePath(cfg.root, file)} =====\n\n${readText(file)}`)
    .join("\n\n");
};

export default assembleCohortService;
