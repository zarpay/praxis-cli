import type { AxiomFile } from "@/models/axiom-file.js";
import type { TraceabilityAssessment } from "@/types.js";
import type { View } from "@framework/types.js";

import chalk from "chalk";

/** Everything the ratifier weighs before the human call. */
interface RatifyReview {
  axiom: AxiomFile;
  /** How many assigned critiques back the proposal. */
  supportingCritiques: number;
  traceability: TraceabilityAssessment;
}

/**
 * Everything the ratifier weighs: the proposal, its supporting
 * evidence, and the curator's traceability assessment — rendered
 * before the human decides.
 */
const ratifyView: View<RatifyReview> = ({ axiom, supportingCritiques, traceability }) => {
  const traceLine = traceability.traceable
    ? `${chalk.green("traceable")} → ${traceability.grounding ?? ""}`
    : chalk.yellow("not traceable — fix the spec and rerun, or reject the proposal");

  return [
    { channel: "heading", text: `Ratify ${axiom.id} v${axiom.version} (${axiom.severity})` },
    {
      channel: "content",
      entries: [
        axiom.statement(),
        "",
        `Supporting critiques: ${supportingCritiques}`,
        "",
        `Spec traceability: ${traceLine}`,
        ...(traceability.quotedBasis === ""
          ? []
          : [`  Basis: ${chalk.gray(traceability.quotedBasis)}`]),
      ],
    },
  ];
};

export default ratifyView;
