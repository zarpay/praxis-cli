import type { Prompt } from "@framework/types.js";

import { preparePrompt } from "@/helpers/prepare-prompt-helper.js";

/**
 * What the triage question's ESTABLISHED AXIOMS section says when the
 * spec has none yet.
 */
const TEXT = `(none yet — every cluster is either a proposal or unassignable)`;

const triageAxiomsFallback: Prompt = preparePrompt(TEXT);

export default triageAxiomsFallback;
