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
2. **propose** — the cluster reveals a standard no axiom names yet AND the specification's text supports it. Draft the axiom at the altitude of one remediation — one fix resolves every critique in the cluster: a one-to-three sentence statement of what it asserts, a violating and a compliant example (drawn from or modeled on the critiques), a severity, and the spec passage that grounds it, quoted verbatim.
3. **unassignable** — the cluster cannot be grounded in this specification's text. Say why, and say which reading your rationale supports: reviewer noise (the reviewer invented or drifted), or a real standard no spec states yet — the second is how unstated team values get discovered, and the humans reading it will extend the specs.

Every critique id appears in exactly one cluster. A cluster of one is fine. Do not force unrelated critiques together to reduce cluster count.`;

const triageQuestion: Prompt<TriageQuestionVariables> = preparePrompt(TEMPLATE);

export default triageQuestion;
