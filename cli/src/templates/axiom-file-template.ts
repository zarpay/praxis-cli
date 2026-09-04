import type { AxiomMode, AxiomScope, AxiomStatus, Severity } from "@/types.js";

/** The fields the proposal template renders into an axiom file. */
interface AxiomTemplateVars {
  id: string;
  status: AxiomStatus;
  mode: AxiomMode;
  scope: AxiomScope;
  severity: Severity;
  /** YYYY-MM-DD; per-axiom population clocks start here (04). */
  introduced: string;
  /** Spec traceability; null until ratification establishes it. */
  groundedIn: string | null;
  statement: string;
  violatingExample: string;
  compliantExample: string;
}

/**
 * The document a triage-accepted draft becomes: one axiom file, ready
 * for `.praxis/axioms/proposed/` (04).
 *
 * `grounded_in` is written only once ratification establishes it — an
 * absent key and a null are the same claim, and absence keeps proposal
 * files honest about what has not happened yet.
 */
export default function axiomFileTemplate({
  id,
  status,
  mode,
  scope,
  severity,
  introduced,
  groundedIn,
  statement,
  violatingExample,
  compliantExample,
}: AxiomTemplateVars): string {
  const grounding = groundedIn === null ? "" : `grounded_in: ${groundedIn}\n`;

  return `---
id: ${id}
version: 1
status: ${status}
mode: ${mode}
scope: ${scope}
severity: ${severity}
${grounding}introduced: ${introduced}
---

${statement}

## Violating example

${violatingExample}

## Compliant example

${compliantExample}
`;
}
