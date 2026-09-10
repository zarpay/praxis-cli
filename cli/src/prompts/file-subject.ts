import type { Prompt } from "@framework/types.js";

import { preparePrompt } from "@/helpers/prepare-prompt-helper.js";

/** The validation question's subject frame for a single file. */
interface FileSubjectVariables {
  fileName: string;
  directory: string;
}

const TEMPLATE = `## FILE TO VALIDATE

File: {fileName}
Directory: {directory}`;

const fileSubject: Prompt<FileSubjectVariables> = preparePrompt(TEMPLATE);

export default fileSubject;
