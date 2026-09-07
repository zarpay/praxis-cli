import type { ActiveAxiom, PendingCritique } from "@/types.js";

/**
 * The labeling question (04, review→label): given one spec's active
 * axioms and its pending critiques, which critiques are squarely an
 * instance of which axiom? The curator labels; a human can override any
 * label at curate — so the instruction optimizes for precision over
 * coverage: an uncertain critique left unlabeled costs one curate
 * moment, a wrong label corrupts a rate.
 */
export default function labelingQuestion({
  specPath,
  axioms,
  pending,
}: {
  specPath: string;
  axioms: readonly ActiveAxiom[];
  pending: readonly PendingCritique[];
}): string {
  const axiomBlocks = axioms.map(
    (axiom) => `### ${axiom.id} (severity: ${axiom.severity})

${axiom.body.trim()}`,
  );

  const critiqueLines = pending.map(
    (critique) => `- [${critique.id}] (${critique.filePath}) ${critique.text}`,
  );

  return `## THE ACTIVE AXIOMS OF ${specPath}

${axiomBlocks.join("\n\n")}

## THE PENDING CRITIQUES

${critiqueLines.join("\n")}

## YOUR TASK

For each critique, decide whether it is squarely an instance of exactly one axiom above — the axiom's fix would resolve the critique, and the critique says what the axiom's statement says.

- Squarely an instance: label it with that axiom's id.
- Anything else — partially related, two axioms at once, a new idea, uncertain — label it null. Unlabeled critiques go to a human session; a wrong label corrupts every rate computed under the axiom.

Call the labeling tool with one entry per critique, in the order given.`;
}
