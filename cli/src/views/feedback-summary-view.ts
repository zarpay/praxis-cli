import type { ProviderUsage } from "@/types.js";
import type { View } from "@framework/types.js";

import { badge } from "@framework/views/badges.js";
import { duration } from "@framework/views/duration.js";

/** What a finished feedback run reports. */
interface FeedbackSummary {
  /** Provider spend, or null when every unit answered from cache. */
  usage: ProviderUsage | null;
  elapsedMs: number;
}

/**
 * What a feedback run cost the person who asked for it.
 *
 * Time always, because this is the command someone runs while waiting.
 * Cost only when a reviewer was actually called — a run answered from
 * cache spent nothing, and "$0.0000" would claim a measurement never
 * taken.
 */
const feedbackSummaryView: View<FeedbackSummary> = ({ usage, elapsedMs }) => {
  const time = `Time: ${duration(elapsedMs)}`;
  const paid = usage?.costUsd !== null && usage?.costUsd !== undefined;
  const text = paid ? `${time}, Cost: $${usage.costUsd?.toFixed(4)}` : `${time} (from cache)`;

  return [{ channel: "content", entries: ["", badge("SPEND", "blue", text)] }];
};

export default feedbackSummaryView;
