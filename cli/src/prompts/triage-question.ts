import type { OrganizeTriageInput } from "@/types.js";

/**
 * The triage organization request (04): one spec's unassigned
 * critiques, the established axioms they may fold into, and the spec
 * itself for grounding. The curator clusters and suggests; the human
 * session that follows decides.
 *
 * Critiques and axioms arrive sorted by the caller, so identical state
 * renders identical bytes.
 */
export default function triageQuestion({
  specPath,
  specContent,
  critiques,
  axioms,
}: Pick<OrganizeTriageInput, "specPath" | "specContent" | "critiques" | "axioms">): string {
  const critiqueLines = critiques.map(
    (critique) =>
      `- id: ${critique.id}\n  file: ${critique.filePath}\n  reviewer: ${critique.reviewerName}\n  severity: ${critique.severity}\n  critique: ${critique.text}`,
  );

  const axiomLines =
    axioms.length === 0
      ? ["(none yet — every cluster is either a proposal or unassignable)"]
      : axioms.map((axiom) => `- ${axiom.id}: ${axiom.statement}`);

  return `## THE SPECIFICATION (${specPath})

\`\`\`
${specContent}
\`\`\`

## ESTABLISHED AXIOMS

Critiques that are squarely instances of one of these fold into it:

${axiomLines.join("\n")}

## UNASSIGNED CRITIQUES

Open-channel critiques from real reviews of files this specification governs:

${critiqueLines.join("\n")}

## YOUR TASK

Group these critiques into clusters of the same underlying standard, and for each cluster suggest exactly one of:

1. **assign** — the cluster is squarely an instance of an established axiom. Name it.
2. **propose** — the cluster reveals a standard no axiom names yet AND the specification's text supports it. Draft the axiom: a one-to-three sentence statement of what it asserts, a violating and a compliant example (drawn from or modeled on the critiques), a severity, and the spec passage that grounds it, quoted verbatim.
3. **unassignable** — the cluster cannot be grounded in this specification's text. Say why: these feed the residual rate, the signal that the reviewer is drifting off-spec.

Every critique id appears in exactly one cluster. A cluster of one is fine. Do not force unrelated critiques together to reduce cluster count.`;
}
