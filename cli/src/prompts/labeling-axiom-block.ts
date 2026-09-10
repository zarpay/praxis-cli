import type { Prompt } from "@framework/types.js";

import { preparePrompt } from "@/helpers/prepare-prompt-helper.js";

/** One issue category as the labeling question lists it. */
interface LabelingAxiomBlockVariables {
  id: string;
  statement: string;
}

const TEMPLATE = `- {id}: {statement}`;

const labelingAxiomBlock: Prompt<LabelingAxiomBlockVariables> = preparePrompt(TEMPLATE);

export default labelingAxiomBlock;
