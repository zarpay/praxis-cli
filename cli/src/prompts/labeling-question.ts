import type { Prompt } from "@framework/types.js";

import { preparePrompt } from "@/helpers/prepare-prompt-helper.js";

/**
 * The labeling question: is this one critique clearly reporting the
 * recurring issue exactly one of the active categories names?
 *
 * One critique per call, by design: a batched list lets earlier answers
 * anchor later ones and dilutes attention across items, so ordering
 * becomes a source of mislabeling. A single-critique prompt has no
 * order to bias it. The curator labels; a human can override any label
 * — so the instruction optimizes for precision over coverage: an
 * uncertain critique left unlabeled costs one curate moment, a wrong
 * label corrupts a count.
 *
 * `axiomBlocks` and `critiqueLine` arrive pre-rendered by the caller
 * from labeling-axiom-block and labeling-critique-line.
 */
interface LabelingQuestionVariables {
  axiomBlocks: string;
  critiqueLine: string;
}

const TEMPLATE = `## THE ISSUE CATEGORIES

Each axiom names one recurring issue the team tracks:

{axiomBlocks}

## THE PENDING CRITIQUE

{critiqueLine}

## YOUR TASK

Decide whether this critique clearly reports the issue exactly one category above names — a reader filing it there would find it among like critiques, and the team decision that settles that category settles this critique too.

- Clearly that issue: answer with the category's axiom id.
- Anything else — a different issue, two categories at once, a new kind of issue, uncertain — answer null. Unlabeled critiques go to a human session; a wrong label corrupts every count computed under the category.

Call the labeling tool with your verdict.`;

const labelingQuestion: Prompt<LabelingQuestionVariables> = preparePrompt(TEMPLATE);

export default labelingQuestion;
