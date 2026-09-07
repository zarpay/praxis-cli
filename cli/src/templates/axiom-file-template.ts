import type { AxiomMode, AxiomStatus, Severity } from "@/types.js";

/** The fields the proposal template renders into an axiom file. */
interface AxiomTemplateVars {
  id: string;
  status: AxiomStatus;
  mode: AxiomMode;
  severity: Severity;
  /** YYYY-MM-DD; per-axiom population clocks start here (04). */
  introduced: string;
  /** The spec passage ratification derived it from; null until then. */
  derivedFrom: string | null;
  statement: string;
  violatingExample: string;
  compliantExample: string;
}

/**
 * The document a triage-accepted draft becomes: one axiom file, ready
 * for `.praxis/axioms/proposed/` (04).
 *
 * `derived_from` is written only once ratification establishes it — an
 * absent key and a null are the same claim, and absence keeps proposal
 * files honest about what has not happened yet.
 */
export default function axiomFileTemplate({
  id,
  status,
  mode,
  severity,
  introduced,
  derivedFrom,
  statement,
  violatingExample,
  compliantExample,
}: AxiomTemplateVars): string {
  const derivation = derivedFrom === null ? "" : `derived_from: ${derivedFrom}\n`;

  return `---
id: ${id}
version: 1
status: ${status}
mode: ${mode}
severity: ${severity}
${derivation}introduced: ${introduced}
---

${statement}

## Violating example

${violatingExample}

## Compliant example

${compliantExample}
`;
}
