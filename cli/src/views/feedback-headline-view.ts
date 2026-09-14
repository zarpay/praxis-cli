import type { View } from "@framework/types.js";

import { palette } from "@framework/views/palette.js";

/** What a feedback run announces before it starts. */
interface FeedbackHeadline {
  /** The path the reader asked about. */
  target: string;
  /** The units the specs say cover it, already named for display. */
  units: string[];
}

/**
 * What `praxis feedback` announces before it starts.
 *
 * It names the units it resolved to, because they are not always what
 * was typed: a directory covers several, and a file inside a cohort
 * resolves to the whole cohort. Showing the resolution makes that
 * visible rather than surprising.
 *
 * It also says the run will not be queued, once, up front — the whole
 * reason someone reaches for this command instead of `eval run`.
 */
const feedbackHeadlineView: View<FeedbackHeadline> = ({ target, units }) => {
  const resolved =
    units.length === 1 && units[0] === target ? [] : units.map((unit) => `  ${unit}`);

  return [
    {
      channel: "content",
      entries: [
        `Feedback on ${target}...`,
        ...(resolved.length > 0 ? [palette.meta("  covering:"), ...resolved] : []),
        palette.meta("  recorded with its cost; never queued for triage"),
      ],
    },
  ];
};

export default feedbackHeadlineView;
