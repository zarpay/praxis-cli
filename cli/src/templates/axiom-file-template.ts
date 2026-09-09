import type { AxiomMode, AxiomStatus } from "@/types.js";

/** The fields the acceptance template renders into an axiom file. */
interface AxiomTemplateVars {
  id: string;
  status: AxiomStatus;
  mode: AxiomMode;
  /** YYYY-MM-DD; per-axiom population clocks start here. */
  introduced: string;
  /** The spec passage the accepted category derived from. */
  derivedFrom: string;
  statement: string;
}

/**
 * The document a curate-accepted category becomes: frontmatter plus the
 * statement naming the recurring issue — nothing else. The norm lives
 * in the spec `derived_from` points at, and the category's real
 * examples live in the ledger as its labeled critiques.
 */
export default function axiomFileTemplate({
  id,
  status,
  mode,
  introduced,
  derivedFrom,
  statement,
}: AxiomTemplateVars): string {
  return `---
id: ${id}
version: 1
status: ${status}
mode: ${mode}
derived_from: ${derivedFrom}
introduced: ${introduced}
---

${statement}
`;
}
