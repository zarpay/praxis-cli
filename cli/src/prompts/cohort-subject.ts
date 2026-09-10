import type { Prompt } from "@framework/types.js";

import { preparePrompt } from "@/helpers/prepare-prompt-helper.js";

/** The validation question's subject frame for a cohort of files. */
interface CohortSubjectVariables {
  targetPath: string;
}

const TEMPLATE = `## FILES TO VALIDATE

The following files form one unit (cohort). Review them together as a
set against the specification; each file is labeled with its path.

Cohort: {targetPath}`;

const cohortSubject: Prompt<CohortSubjectVariables> = preparePrompt(TEMPLATE);

export default cohortSubject;
