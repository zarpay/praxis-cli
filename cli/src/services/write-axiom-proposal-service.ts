import type { WriteAxiomProposalInput, WriteAxiomProposalResult } from "@/types.js";

import { writeText } from "@/helpers/files-helper.js";
import { joinPath } from "@/helpers/paths-helper.js";
import newAxiomIdService from "@/services/new-axiom-id-service.js";
import axiomFileTemplate from "@/templates/axiom-file-template.js";

/**
 * Lands one triage-accepted draft in `.praxis/axioms/proposed/` (04).
 *
 * Proposals have no metric effect and no grounding yet — `grounded_in`
 * is established at ratification, and `status: active` is a human
 * decision this service never makes.
 */
export default function writeAxiomProposalService({
  root,
  statement,
  severity,
  scope,
  violatingExample,
  compliantExample,
}: WriteAxiomProposalInput): WriteAxiomProposalResult {
  const id = newAxiomIdService({ root });

  const document = axiomFileTemplate({
    id,
    status: "proposed",
    mode: "judgment",
    scope,
    severity,
    introduced: new Date().toISOString().slice(0, 10),
    groundedIn: null,
    statement,
    violatingExample,
    compliantExample,
  });

  const path = joinPath(root, ".praxis", "axioms", "proposed", `${id}.md`);

  writeText(path, document);

  return { id, path };
}
