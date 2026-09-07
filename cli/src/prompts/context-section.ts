import type { Prompt } from "@framework/types.js";

import { preparePrompt } from "@/helpers/prepare-prompt-helper.js";

/**
 * The CONTEXT prompt section: assist-only reference files that inform
 * the review and never receive a verdict. `blocks` is the
 * context-block renderings joined; when the spec declares none the
 * caller passes "" for the whole section instead, so it vanishes from
 * the prompt entirely. The trailing blank line is structural — it
 * separates this section from what follows in the validation question.
 */
interface ContextSectionVariables {
  blocks: string;
}

const TEMPLATE = `## CONTEXT

The following files are reference context: what the specification's
subject matter is about. They are not under review and must not be
critiqued — use them only to inform your review.

{blocks}

`;

const contextSection: Prompt<ContextSectionVariables> = preparePrompt(TEMPLATE);

export default contextSection;
