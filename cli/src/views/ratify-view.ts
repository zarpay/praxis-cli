import type { AxiomFile } from "@/models/axiom-file.js";
import type { GateAssessment, TraceabilityAssessment } from "@/types.js";
import type { View } from "@framework/types.js";

import chalk from "chalk";

/**
 * Everything the ratifier weighs (04): the proposal, its supporting
 * evidence, the authoring gate's verdict, and the curator's
 * traceability assessment — rendered before the human decides.
 */
const ratifyView: View<{
  axiom: AxiomFile;
  supportingCritiques: number;
  gate: GateAssessment;
  traceability: TraceabilityAssessment;
}> = ({ axiom, supportingCritiques, gate, traceability }) => {
  const gateColor = colorFor(gate.assessment);

  const traceLine = traceability.traceable
    ? `${chalk.green("traceable")} → ${traceability.grounding ?? ""}`
    : chalk.yellow("not traceable — fix the spec and rerun, or reject as reviewer noise");

  return [
    { channel: "heading", text: `Ratify ${axiom.id} v${axiom.version} (${axiom.severity})` },
    {
      channel: "content",
      entries: [
        axiom.statement(),
        "",
        `Supporting critiques: ${supportingCritiques}`,
        `Authoring gate: ${gateColor(gate.assessment)} — ${gate.reasoning}`,
        ...(gate.judgmentHalf ? [`  Judgment half: ${gate.judgmentHalf}`] : []),
        `Spec traceability: ${traceLine}`,
        ...(traceability.quotedBasis === ""
          ? []
          : [`  Basis: ${chalk.gray(traceability.quotedBasis)}`]),
      ],
    },
  ];
};

export default ratifyView;

/** Green admits, yellow splits, red refuses. */
function colorFor(assessment: string): (text: string) => string {
  if (assessment === "appropriate") return chalk.green;

  if (assessment === "split") return chalk.yellow;

  return chalk.red;
}
