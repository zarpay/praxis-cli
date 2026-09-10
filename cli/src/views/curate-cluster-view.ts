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
 * One cluster of the curate session, framed as a card the human decides
 * on: the curator's rationale as the heading, each distinct critique as
 * its own two-line block (duplicates counted, not repeated), a blank
 * line, then the suggestion — one cluster at a time, nothing running
 * together.
 */
const curateClusterView: View<TriageClusterCard> = ({ index, total, cluster, critiques }) => {
  const critiqueBlocks = critiques.flatMap((critique) => {
    const copies = critique.copies > 1 ? chalk.gray(` (×${critique.copies})`) : "";

    return [
      `  ${critique.filePath} ${chalk.gray(`[${critique.reviewerName}]`)}${copies} ${chalk.gray(critique.id)}`,
      `    ${chalk.dim(critique.text)}`,
      "",
    ];
  });

  const lines: ReportLine[] = [
    { channel: "heading", text: `Cluster ${index}/${total} — ${cluster.rationale}` },
    {
      channel: "content",
      entries: [...critiqueBlocks, ...suggestionLines(cluster)],
    },
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
      `${chalk.cyan("Suggests:")} a new issue category`,
      "",
      `  ${chalk.bold(draft.statement)}`,
      draft.groundingHint === "" ? "" : `  Derives from: ${chalk.gray(draft.groundingHint)}`,
    ].filter(Boolean);
  }

  return [
    `${chalk.yellow("Suggests:")} hold — ${suggestion.why} (stays in the queue for the next session)`,
  ];
}
