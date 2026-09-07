import type { Prompt } from "@framework/types.js";

import { preparePrompt } from "@/helpers/prepare-prompt-helper.js";

/** One pending critique as the labeling question lists it. */
interface LabelingCritiqueLineVariables {
  id: string;
  filePath: string;
  text: string;
}

const TEMPLATE = `- [{id}] ({filePath}) {text}`;

const labelingCritiqueLine: Prompt<LabelingCritiqueLineVariables> = preparePrompt(TEMPLATE);

export default labelingCritiqueLine;
