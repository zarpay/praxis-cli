import type { Prompt } from "@framework/types.js";

import { preparePrompt } from "@/helpers/prepare-prompt-helper.js";

/**
 * Curate's traceability question at acceptance: which spec criterion
 * grounds this draft? Traceable activates; untraceable holds the
 * cluster until the spec is extended — the assessment is evidence for
 * that outcome, never the decision itself.
 */
interface TraceabilityQuestionVariables {
  specPath: string;
  specContent: string;
  statement: string;
}

const TEMPLATE = `## THE SPECIFICATION ({specPath})

{specContent}

## THE PROPOSED AXIOM

{statement}

## YOUR TASK

Answer: which criterion in this specification grounds the proposed axiom?

- If a passage states or clearly implies the standard: **traceable**. Give the grounding as "{specPath}#section" using the nearest heading, and quote the passage verbatim.
- If no passage supports it but the standard seems real: **not traceable**. The honest response to a real-but-untraceable standard is to extend the specification first — say what is missing. If the standard is true across many specifications (a universal value like plainness or simplicity), say so: it belongs stated once in a conventions-grade specification covering everything it governs, and the axiom grounds there — never stretched into a partial grounding here.
- If no passage supports it: **not traceable**, and say so plainly — the humans decide whether to extend the spec or reject the proposal.

Never stretch a passage to cover a standard it does not state. A generous reading here corrupts every rate computed under the axiom later.`;

const traceabilityQuestion: Prompt<TraceabilityQuestionVariables> = preparePrompt(TEMPLATE);

export default traceabilityQuestion;
