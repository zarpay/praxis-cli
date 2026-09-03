import type { AxiomTemplateVars } from "@/types.js";

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
