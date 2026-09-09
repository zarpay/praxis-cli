import type { View } from "@framework/types.js";

import { statLines } from "@framework/views/stats.js";

/** A review session's counted outcome. */
interface ReviewOutcome {
  /** Critiques shown and judged this session. */
  reviewed: number;
  dismissed: number;
  /** Unlabeled critiques in scope not reached before quitting. */
  remaining: number;
  /** Critiques whose dismissal stands, ledger-wide. */
  dismissedTotal: number;
  /** Every critique in the ledger. */
  critiquesTotal: number;
}

/**
 * A review session's outcome: what was judged and dismissed this
 * session, what was not reached, and the ledger-wide dismissal count
 * beside its denominator — the reviewer-trust signal in one line.
 */
const reviewSummaryView: View<ReviewOutcome> = ({
  reviewed,
  dismissed,
  remaining,
  dismissedTotal,
  critiquesTotal,
}) => {
  const counts: [string, string | number][] = [
    ["Reviewed", reviewed],
    ["Dismissed", dismissed],
    ["Not reached", remaining],
  ];

  return [
    { channel: "heading", text: "Review session" },
    {
      channel: "content",
      entries: [
        ...statLines(counts),
        "",
        `Dismissed ledger-wide: ${dismissedTotal}/${critiquesTotal} critiques — many dismissals mean the specs disagree with the humans, or the reviewers are drifting.`,
      ],
    },
  ];
};

export default reviewSummaryView;
