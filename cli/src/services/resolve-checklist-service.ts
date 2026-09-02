import type { ChecklistAxiom, ResolveChecklistInput } from "@/types.js";

import { relativePath } from "@/helpers/paths-helper.js";
import listAxiomsService from "@/services/list-axioms-service.js";

/**
 * The checklist channel for one spec (04): every **active** axiom whose
 * `grounded_in` names the spec, sorted by id so identical state always
 * renders — and hashes — identical bytes.
 *
 * Proposed axioms have no metric effect and never reach the reviewer;
 * deprecated ones stopped being asked. Cross-spec axioms are undecided
 * in 04, so grounding is per-spec: `grounded_in`'s path segment (before
 * any `#section`) must equal the spec's project-relative path.
 */
export default function resolveChecklistService({
  root,
  specPath,
}: ResolveChecklistInput): ChecklistAxiom[] {
  const { axioms } = listAxiomsService({ root });
  const spec = relativePath(root, specPath);

  return axioms
    .filter((axiom) => axiom.status === "active")
    .filter((axiom) => axiom.groundedIn !== null && axiom.groundedIn.split("#")[0] === spec)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((axiom) => ({
      id: axiom.id,
      version: axiom.version,
      severity: axiom.severity,
      statement: axiom.statement(),
      body: axiom.body,
    }));
}
