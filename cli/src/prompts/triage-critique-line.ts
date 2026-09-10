import type { Prompt } from "@framework/types.js";

import { preparePrompt } from "@/helpers/prepare-prompt-helper.js";

/** One unassigned critique as the triage question lists it. */
interface TriageCritiqueLineVariables {
  id: string;
  filePath: string;
  reviewerName: string;
  severity: string;
  text: string;
}

const TEMPLATE = `- id: {id}
  file: {filePath}
  reviewer: {reviewerName}
  severity: {severity}
  critique: {text}`;

const triageCritiqueLine: Prompt<TriageCritiqueLineVariables> = preparePrompt(TEMPLATE);

export default triageCritiqueLine;
