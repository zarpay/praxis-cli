import type { PendingCritique, TriageCluster } from "@/types.js";
import type { ReportLine, View } from "@framework/types.js";

import chalk from "chalk";

/** One distinct critique shown for a cluster, with its duplicate count. */
type ClusterCritique = PendingCritique & {
  /** Pending critiques sharing this exact text (1 = no duplicates). */
  copies: number;
};

/** One cluster of a curate session, framed for its decision. */
interface TriageClusterCard {
  /** 1-based position in the session. */
  index: number;
  total: number;
  cluster: TriageCluster;
  critiques: ClusterCritique[];
}

/**
 * One cluster of the curate session (04): the curator's grouping and
 * suggestion, with the distinct critiques as evidence (duplicates
 * counted, not repeated) — everything the human needs on screen to
 * fold, dismiss, or accept.
 */
const curateClusterView: View<TriageClusterCard> = ({ index, total, cluster, critiques }) => {
  const lines: ReportLine[] = [
    { channel: "heading", text: `Cluster ${index}/${total} — ${cluster.rationale}` },
    {
      channel: "content",
      entries: critiques.map((critique) => {
        const copies = critique.copies > 1 ? chalk.gray(` (×${critique.copies})`) : "";

        return `  ${chalk.gray(critique.id)} ${critique.filePath} ${chalk.gray(`[${critique.reviewerName}]`)}${copies}\n    ${critique.text}`;
      }),
    },
    { channel: "content", entries: ["", ...suggestionLines(cluster)] },
  ];

  return lines;
};

export default curateClusterView;

/** The curator's suggestion, framed for the decision it asks for. */
function suggestionLines(cluster: TriageCluster): string[] {
  const { suggestion } = cluster;

  if (suggestion.kind === "assign") {
    return [`${chalk.cyan("Suggests:")} fold into ${chalk.bold(suggestion.axiomId)}`];
  }

  if (suggestion.kind === "propose") {
    const { draft } = suggestion;

    return [
      `${chalk.cyan("Suggests:")} propose a new axiom (severity: ${draft.severity})`,
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
