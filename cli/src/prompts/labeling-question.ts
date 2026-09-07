import type { Prompt } from "@framework/types.js";

import { preparePrompt } from "@/helpers/prepare-prompt-helper.js";

/**
 * The labeling question (04, review→label): given one spec's active
 * axioms and its pending critiques, which critiques are squarely an
 * instance of which axiom? The curator labels; a human can override any
 * label at curate — so the instruction optimizes for precision over
 * coverage: an uncertain critique left unlabeled costs one curate
 * moment, a wrong label corrupts a rate.
 *
 * `axiomBlocks` and `critiqueLines` arrive pre-rendered by the caller
 * from labeling-axiom-block and labeling-critique-line.
 */
interface LabelingQuestionVariables {
  specPath: string;
  axiomBlocks: string;
  critiqueLines: string;
}

const TEMPLATE = `## THE ACTIVE AXIOMS OF {specPath}

{axiomBlocks}

## THE PENDING CRITIQUES

{critiqueLines}

## YOUR TASK

For each critique, decide whether it is squarely an instance of exactly one axiom above — the axiom's fix would resolve the critique, and the critique says what the axiom's statement says.

- Squarely an instance: label it with that axiom's id.
- Anything else — partially related, two axioms at once, a new idea, uncertain — label it null. Unlabeled critiques go to a human session; a wrong label corrupts every rate computed under the axiom.

Call the labeling tool with one entry per critique, in the order given.`;

const labelingQuestion: Prompt<LabelingQuestionVariables> = preparePrompt(TEMPLATE);

export default labelingQuestion;
