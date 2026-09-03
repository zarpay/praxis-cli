/**
 * The authoring gate's question (03): is this candidate axiom
 * appropriate for judgment-based review at all?
 *
 * The litmus tests are the spec's own, verbatim in spirit: they are
 * the boundary's teeth, and the gate is advisory — the assessment is
 * shown to the human who decides.
 */
export default function gateQuestion({
  statement,
  violatingExample,
  compliantExample,
}: {
  statement: string;
  violatingExample: string;
  compliantExample: string;
}): string {
  return `## CANDIDATE AXIOM

Statement: ${statement}

Violating example:
${violatingExample}

Compliant example:
${compliantExample}

## YOUR TASK

Assess whether deciding this standard requires reading comprehension, applying these litmus tests:

- Could a regex or AST query decide it with zero false positives on adversarial input? If yes → **not_appropriate**: it belongs in static tooling, and every mechanical criterion kept away from an LLM reviewer is a class of reviewer error made impossible.
- Would two senior engineers ever disagree on a verdict? If never → probably mechanical → **not_appropriate**.
- Does the criterion turn on meaning — "descriptive", "complete", "justified", "belongs" — rather than presence? If yes → **appropriate**.
- Does the candidate mix both — a mechanical half and a judgment half in one statement? That is the common case in real specs → **split**, and redraft the judgment half alone as the admissible statement.

The aphorism that governs: if you can write the check, write the check; if you can only describe the standard, write the axiom.`;
}
