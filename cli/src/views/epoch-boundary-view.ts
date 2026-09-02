import type { EpochBoundary } from "@/types.js";
import type { ReportLine, View } from "@framework/types.js";

/**
 * The run-start announcement of an epoch boundary (02): a reviewer's
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
    ...boundaries.map(warningLine),
    {
      channel: "content",
      entries: [
        "Numbers do not cross an epoch boundary. Run a full `praxis eval run` to open the new epoch with a baseline.",
      ],
    },
  ];
};

/** One boundary, named by what changed. */
function warningLine(boundary: EpochBoundary): ReportLine {
  const { reviewerName, currentModel, previousModel, lastRunTimestamp } = boundary;
  const date = lastRunTimestamp.slice(0, 10);

  const cause =
    currentModel === previousModel
      ? "config or prompt surface changed — a praxis upgrade changes the prompt surface, so check CLI versions across the team"
      : `model → ${currentModel}`;

  return {
    channel: "warning",
    text: `Epoch boundary — reviewer "${reviewerName}": ${cause} (last run ${date})`,
  };
}

export default epochBoundaryView;
