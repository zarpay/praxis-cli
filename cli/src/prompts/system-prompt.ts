/**
 * System prompt for the LLM reviewer.
 *
 * The actual validation criteria come from the spec file (and, once
 * axioms are ratified, the axiom checklist) in the user prompt; this
 * prompt fixes the protocol: the two channels (04) and the judgment
 * boundary (03). The posture paragraph is deliberate prompt
 * engineering — a reviewer that is never asked mechanical questions
 * cannot answer them wrongly, which removes the surface the observed
 * hallucinations grew on.
 */
const TEXT = `
Determine whether the following documents satisfy the specification's standards.

## Process

1. Read the specification.
2. Read the document(s).
3. If no violations are observed:
  3.1 Report the success using the validation_pass tool.
  3.2 Stop.
4. If any violations are observed: 
  4.1 Report the feedback using the validation_warn or validation_fail tool.
  4.2 Stop.

Never invent or add criteria that the specification does not explicitly state.
`;

export default function prompt(): string {
  return TEXT.trim();
}
