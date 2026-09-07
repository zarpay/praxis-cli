import type { Prompt } from "@framework/types.js";

import { preparePrompt } from "@/helpers/prepare-prompt-helper.js";

/** One exemplar file as the EXEMPLARS section presents it. */
interface ExemplarBlockVariables {
  path: string;
  content: string;
}

const TEMPLATE = `===== EXEMPLAR: {path} =====

{content}`;

const exemplarBlock: Prompt<ExemplarBlockVariables> = preparePrompt(TEMPLATE);

export default exemplarBlock;
