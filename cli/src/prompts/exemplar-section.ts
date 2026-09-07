import type { Prompt } from "@framework/types.js";

import { preparePrompt } from "@/helpers/prepare-prompt-helper.js";

/**
 * The EXEMPLARS prompt section: spec-blessed positive examples, shown
 * as labeled references and never reviewed (03). `blocks` is the
 * exemplar-block renderings joined; when the spec blesses none the
 * caller passes "" for the whole section instead, so it vanishes from
 * the prompt entirely. The trailing blank line is structural — it
 * separates this section from what follows in the validation question.
 */
interface ExemplarSectionVariables {
  blocks: string;
}

const TEMPLATE = `## EXEMPLARS

The following files are spec-blessed positive examples. They are not
under review — use them as concrete references for what satisfying
the specification looks like.

{blocks}

`;

const exemplarSection: Prompt<ExemplarSectionVariables> = preparePrompt(TEMPLATE);

export default exemplarSection;
