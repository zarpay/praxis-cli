import type { Prompt } from "@framework/types.js";

import { preparePrompt } from "@/helpers/prepare-prompt-helper.js";

/**
 * The triage organization request: one spec's unassigned
 * critiques, the established axioms they may fold into, and the spec
 * itself for grounding. The curator clusters and suggests; the human
 * session that follows decides.
 *
 * `axiomLines` and `critiqueLines` arrive pre-rendered by the caller
 * (triage-axiom-line, triage-critique-line, triage-axioms-fallback),
 * sorted so identical state renders identical bytes.
 */
interface TriageQuestionVariables {
  specPath: string;
  specContent: string;
  axiomLines: string;
  critiqueLines: string;
}

const TEMPLATE = `## THE SPECIFICATION ({specPath})

\`\`\`
{specContent}
\`\`\`

## ESTABLISHED AXIOMS

Critiques that are squarely instances of one of these fold into it:

{axiomLines}

## UNASSIGNED CRITIQUES

Open-channel critiques from real reviews of files this specification governs:

{critiqueLines}

## YOUR TASK

Group these critiques into clusters of the same underlying standard, and for each cluster suggest exactly one of:

1. **assign** — the cluster is squarely an instance of an established axiom: that axiom's fix would resolve every critique in the cluster. Name it. Do not stretch a broad axiom over critiques whose remediation differs from its own.
2. **propose** — the cluster reveals a recurring issue no category names yet AND the specification's text supports caring about it. Draft the category at the altitude of one convention the team decides as a unit: a one-to-two sentence statement that NAMES THE OBSERVED ISSUE, neutrally ("Type definitions placed outside the feature's dedicated home"), plus the spec passage that grounds it, quoted verbatim. Never restate the specification's rule and never prescribe — if the draft reads like a passage from a spec, name the failure instead. Draft only issues that need reading comprehension to see. If a regex or AST query could decide the matter with zero false positives, or two senior engineers could never disagree, it is mechanical: it belongs in static tooling, so hold the cluster and say so. When a cluster mixes a mechanical half with a judgment half, draft the judgment half alone. Never draft a near-twin: if an established category already collects this issue, assign instead.
3. **hold** — no axiom emerges yet: the evidence is too thin to name a standard, the specification's text does not state one, or the standard is mechanical. Say which. The critiques are valid evidence and stay in the queue for the next session, where new critiques may complete the pattern; when the spec is silent, the humans reading your reason will extend it. Never judge whether a critique is true — every critique here has been accepted as evidence.

Every critique id appears in exactly one cluster. A cluster of one is fine. Do not force unrelated critiques together to reduce cluster count.`;

const triageQuestion: Prompt<TriageQuestionVariables> = preparePrompt(TEMPLATE);

export default triageQuestion;
