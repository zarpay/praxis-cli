import type { PendingCritique, TriageCluster } from "@/types.js";
import type { ReportLine, View } from "@framework/types.js";

import { card } from "@framework/views/card.js";
import { palette } from "@framework/views/palette.js";

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
    const copies = critique.copies > 1 ? palette.meta(` (×${critique.copies})`) : "";

    return [
      `${critique.filePath} ${palette.meta(`[${critique.reviewerName}]`)}${copies} ${palette.meta(critique.id)}`,
      palette.quote(`  ${critique.text}`),
      "",
    ];
  });

  const clusterCard = card({
    title: `cluster ${index}/${total}`,
    body: [cluster.rationale, "", ...critiqueBlocks.slice(0, -1)],
    footer: suggestionLines(cluster),
  });

  const lines: ReportLine[] = [{ channel: "content", entries: ["", ...clusterCard] }];

  return lines;
};

export default curateClusterView;

/** The curator's suggestion, framed for the decision it asks for. */
function suggestionLines(cluster: TriageCluster): string[] {
  const { suggestion } = cluster;

  if (suggestion.kind === "assign") {
    return [`${palette.ref("suggests")}  fold into ${palette.ref(suggestion.axiomId)}`];
  }

  if (suggestion.kind === "propose") {
    const { draft } = suggestion;

    return [
      `${palette.ref("suggests")}  a new issue category`,
      "",
      `  ${palette.structure(draft.statement)}`,
      draft.groundingHint === "" ? "" : `  derives from ${palette.meta(draft.groundingHint)}`,
    ].filter(Boolean);
  }

  return [
    `${palette.warn("suggests")}  hold — ${suggestion.why}`,
    palette.meta("(stays in the queue for the next session)"),
  ];
}
