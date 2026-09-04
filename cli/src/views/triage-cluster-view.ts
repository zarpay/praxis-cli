import type { PendingCritique, TriageCluster } from "@/types.js";
import type { ReportLine, View } from "@framework/types.js";

import chalk from "chalk";

/** One cluster of a triage session, framed for its decision. */
interface TriageClusterCard {
  /** 1-based position in the session. */
  index: number;
  total: number;
  cluster: TriageCluster;
  critiques: PendingCritique[];
}

/**
 * One cluster of the triage session (04): the curator's grouping and
 * suggestion, with the critiques as evidence — everything the human
 * needs on screen to fold, dismiss, or accept.
 */
const triageClusterView: View<TriageClusterCard> = ({ index, total, cluster, critiques }) => {
  const lines: ReportLine[] = [
    { channel: "heading", text: `Cluster ${index}/${total} — ${cluster.rationale}` },
    {
      channel: "content",
      entries: critiques.map(
        (critique) =>
          `  ${chalk.gray(critique.id)} ${critique.filePath} ${chalk.gray(`[${critique.reviewerName}]`)}\n    ${critique.text}`,
      ),
    },
    { channel: "content", entries: ["", ...suggestionLines(cluster)] },
  ];

  return lines;
};

export default triageClusterView;

/** The curator's suggestion, framed for the decision it asks for. */
function suggestionLines(cluster: TriageCluster): string[] {
  const { suggestion } = cluster;

  if (suggestion.kind === "assign") {
    return [`${chalk.cyan("Suggests:")} fold into ${chalk.bold(suggestion.axiomId)}`];
  }

  if (suggestion.kind === "propose") {
    const { draft } = suggestion;

    return [
      `${chalk.cyan("Suggests:")} propose a new axiom (severity: ${draft.severity}, scope: ${draft.scope})`,
      `  ${chalk.bold(draft.statement)}`,
      `  Violating: ${draft.violatingExample}`,
      `  Compliant: ${draft.compliantExample}`,
      draft.groundingHint === "" ? "" : `  Grounded in: ${chalk.gray(draft.groundingHint)}`,
    ].filter(Boolean);
  }

  return [
    `${chalk.yellow("Suggests:")} unassignable — ${suggestion.why} (feeds the residual rate)`,
  ];
}
