import type { Prompt } from "@framework/types.js";

import { preparePrompt } from "@/helpers/prepare-prompt-helper.js";

/** One reference file as the CONTEXT section presents it. */
interface ContextBlockVariables {
  path: string;
  content: string;
}

const TEMPLATE = `===== CONTEXT: {path} =====

{content}`;

const contextBlock: Prompt<ContextBlockVariables> = preparePrompt(TEMPLATE);

export default contextBlock;
