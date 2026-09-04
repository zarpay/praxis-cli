import type { View } from "@framework/types.js";

/** A triage session's counted outcome. */
interface TriageOutcome {
  assigned: number;
  proposed: number;
  dismissed: number;
  skipped: number;
  /** Open-channel critiques still waiting after the session. */
  pendingLeft: number;
  /** Curator spend across the session, or null when nothing reported. */
  costUsd: number | null;
}

/**
 * A triage session's outcome: every decision counted, the residual
 * named, and the next commands in reach (09: drill-down, not dumps).
 */
const triageSummaryView: View<TriageOutcome> = ({
  assigned,
  proposed,
  dismissed,
  skipped,
  pendingLeft,
  costUsd,
}) => {
  const cost = costUsd === null ? "" : ` · curator cost $${costUsd.toFixed(4)}`;

  return [
    { channel: "heading", text: "Triage session" },
    {
      channel: "content",
      entries: [
        `Assigned: ${assigned} · Proposed into new axioms: ${proposed} · Dismissed: ${dismissed} · Skipped: ${skipped}`,
        `Pending after session: ${pendingLeft}${cost}`,
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

export default triageSummaryView;
