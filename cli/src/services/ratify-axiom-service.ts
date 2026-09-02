import type { RatifyAxiomInput, WriteAxiomProposalResult } from "@/types.js";

import { readText, removeFile, writeText } from "@/helpers/files-helper.js";
import { joinPath } from "@/helpers/paths-helper.js";
import { AxiomFile } from "@/models/axiom-file.js";

/**
 * Ratification's store move (04): the proposal becomes active and
 * records its grounding, leaving `proposed/`.
 *
 * The body is preserved byte-for-byte — a human may have edited the
 * proposal file, and ratifying must never rewrite what a human
 * authored (10). Only two frontmatter facts change: `status: active`,
 * and the `grounded_in` ratification established. The result is
 * validated through the model before anything lands on disk.
 *
 * @throws PraxisError when the moved document would not validate
 */
export default function ratifyAxiomService({
  root,
  id,
  groundedIn,
}: RatifyAxiomInput): WriteAxiomProposalResult {
  const proposedPath = joinPath(root, ".praxis", "axioms", "proposed", `${id}.md`);
  const activePath = joinPath(root, ".praxis", "axioms", `${id}.md`);

  const proposal = readText(proposedPath);
  const ratified = proposal
    .replace(/^status: proposed$/m, "status: active")
    .replace(/^introduced:/m, `grounded_in: ${groundedIn}\nintroduced:`);

  // Refuse to write anything the model would reject.
  AxiomFile.fromContent(ratified, activePath);

  writeText(activePath, ratified);
  removeFile(proposedPath);

  return { id, path: activePath };
}
