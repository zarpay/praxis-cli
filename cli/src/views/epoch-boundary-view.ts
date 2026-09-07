import type { EpochBoundary } from "@/types.js";
import type { ReportLine, View } from "@framework/types.js";

/**
 * The run-start announcement of an epoch boundary: a reviewer's
 * behavioral hash has no history in the ledger, so the numbers on
 * either side of this run are not comparable.
 *
 * Each boundary is named — a model swap says so; anything else is a
 * config or prompt-surface change, and the prompt surface is the one
 * cause with no config diff to see (a praxis upgrade). Warns, never
 * blocks: the run proceeds either way.
 */
const epochBoundaryView: View<EpochBoundary[]> = (boundaries) => {
  if (boundaries.length === 0) return [];

  return [
    ...boundaries.flatMap(boundaryLines),
    {
      channel: "content",
      entries: [
        "  Numbers do not cross an epoch boundary. Run a full `praxis eval run` to open",
        "  the new epoch with a baseline.",
        "",
      ],
    },
  ];
};

/** One boundary: the fact as a warning, the reading of it as detail. */
function boundaryLines(boundary: EpochBoundary): ReportLine[] {
  const { reviewerName, currentModel, previousModel, lastRunTimestamp } = boundary;
  const date = lastRunTimestamp.slice(0, 10);

  if (currentModel !== previousModel) {
    return [
      {
        channel: "warning",
        text: `Epoch boundary — reviewer "${reviewerName}": model → ${currentModel} (last run ${date})`,
      },
    ];
  }

  return [
    {
      channel: "warning",
      text: `Epoch boundary — reviewer "${reviewerName}": config or prompt surface changed (last run ${date})`,
    },
    {
      channel: "content",
      entries: [
        "  A praxis upgrade changes the prompt surface, so check CLI versions across the team.",
      ],
    },
  ];
}

export default epochBoundaryView;
