import type { Prompt } from "@framework/types.js";

import { preparePrompt } from "@/helpers/prepare-prompt-helper.js";

/** One established axiom as the triage question lists it. */
interface TriageAxiomLineVariables {
  id: string;
  statement: string;
}

const TEMPLATE = `- {id}: {statement}`;

const triageAxiomLine: Prompt<TriageAxiomLineVariables> = preparePrompt(TEMPLATE);

export default triageAxiomLine;
