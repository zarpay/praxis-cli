import type { Prompt } from "@framework/types.js";

import { preparePrompt } from "@/helpers/prepare-prompt-helper.js";

/**
 * One active axiom as the labeling question presents it: id and
 * severity headed, statement and examples beneath (`body` is the
 * axiom's body, trimmed by the caller).
 */
interface LabelingAxiomBlockVariables {
  id: string;
  severity: string;
  body: string;
}

const TEMPLATE = `### {id} (severity: {severity})

{body}`;

const labelingAxiomBlock: Prompt<LabelingAxiomBlockVariables> = preparePrompt(TEMPLATE);

export default labelingAxiomBlock;
