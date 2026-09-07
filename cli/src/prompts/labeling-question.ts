import type { Prompt } from "@framework/types.js";

import { preparePrompt } from "@/helpers/prepare-prompt-helper.js";

/**
 * The labeling question: is this one critique
 * squarely an instance of exactly one of its spec's active axioms?
 *
 * One critique per call, by design: a batched list
 * lets earlier answers anchor later ones and dilutes attention across
 * items, so ordering becomes a source of mislabeling. A single-critique
 * prompt has no order to bias it. The curator labels; a human can
 * override any label at curate — so the instruction optimizes for
 * precision over coverage: an uncertain critique left unlabeled costs
 * one curate moment, a wrong label corrupts a rate.
 *
 * `axiomBlocks` and `critiqueLine` arrive pre-rendered by the caller
 * from labeling-axiom-block and labeling-critique-line.
 */
interface LabelingQuestionVariables {
  axiomBlocks: string;
  critiqueLine: string;
}

const TEMPLATE = `## THE ACTIVE AXIOMS

{axiomBlocks}

## THE PENDING CRITIQUE

{critiqueLine}

## YOUR TASK

Decide whether this critique is squarely an instance of exactly one axiom above — the axiom's fix would resolve the critique, and the critique says what the axiom's statement says.

- Squarely an instance: answer with that axiom's id.
- Anything else — partially related, two axioms at once, a new idea, uncertain — answer null. Unlabeled critiques go to a human session; a wrong label corrupts every rate computed under the axiom.

Call the labeling tool with your verdict.`;

const labelingQuestion: Prompt<LabelingQuestionVariables> = preparePrompt(TEMPLATE);

export default labelingQuestion;
