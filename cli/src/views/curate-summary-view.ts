import type { View } from "@framework/types.js";

import { statLines } from "@framework/views/stats.js";

/** A curate session's counted outcome. */
interface TriageOutcome {
  assigned: number;
  proposed: number;
  /** Critiques held as evidence with no axiom yet — the curator's call, accepted. */
  held: number;
  /** Critiques the human skipped — decided nothing. */
  skipped: number;
  /** Critiques still awaiting curation after the session. */
  pendingLeft: number;
  /** Curator spend across the session, or null when nothing reported. */
  costUsd: number | null;
}

/**
 * A curate session's outcome: every decision counted, one per line, what
 * stays in the queue named, and the next command in reach.
 */
const curateSummaryView: View<TriageOutcome> = ({
  assigned,
  proposed,
  held,
  skipped,
  pendingLeft,
  costUsd,
}) => {
  const counts: [string, string | number][] = [
    ["Assigned", assigned],
    ["Proposed", proposed],
    ["Held (no axiom yet)", held],
    ["Skipped", skipped],
    ["Still awaiting curation", pendingLeft],
  ];

  return [
    { channel: "heading", text: "Curate session" },
    {
      channel: "content",
      entries: [
        ...statLines(counts),
        ...(costUsd === null ? [] : ["", `Curator cost: $${costUsd.toFixed(4)}`]),
        ...(proposed > 0
          ? [
              "",
              "Proposals await ratification: `praxis axioms list`, then `praxis axioms ratify <id>`.",
            ]
          : []),
      ],
    },
  ];
};

export default curateSummaryView;
