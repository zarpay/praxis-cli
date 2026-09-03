import type { ChecklistAxiom } from "@/types.js";

/**
 * The checklist channel of the two-channel review (04): every active
 * axiom grounded in the governing spec, with its full teaching material
 * — the reviewer judges against the extension, not just a label.
 *
 * Empty when no axioms govern the spec (bootstrap), rendering nothing:
 * the open channel is then the whole review, which is the degenerate
 * case 04 defines. Entries arrive sorted by id, so identical state
 * always renders identical bytes.
 */
export default function axiomChecklistSection(checklist: readonly ChecklistAxiom[]): string {
  if (checklist.length === 0) return "";

  const entries = checklist.map(
    (axiom) => `### ${axiom.id} — severity: ${axiom.severity}

${axiom.body.trim()}`,
  );

  return `## AXIOM CHECKLIST

These are the ratified standards for this specification. Check the file
against each axiom below first. Report each violation of an axiom with
that axiom's id.

${entries.join("\n\n")}

`;
}
