import type { View } from "@framework/types.js";

/** What an eval run announces before it starts. */
interface EvalHeadline {
  /** Named targets; empty or omitted means a full run. */
  targets?: string[];
  /** CI framing. */
  ci?: boolean;
  /** A full run narrowed to one document type. */
  type?: string;
}

/**
 * What an eval run announces before it starts.
 *
 * A targeted run names one target or counts several — listing them all
 * would bury the progress that follows. A full run says what it covers.
 */
const evalHeadlineView: View<EvalHeadline> = ({ targets, ci, type }) => {
  if (targets && targets.length > 0) {
    const subject = targets.length === 1 ? targets[0] : `${targets.length} targets`;

    return [{ channel: "content", entries: [`Reviewing ${subject}...`] }];
  }

  if (ci) return [{ channel: "content", entries: ["Running CI review..."] }];

  const scope = type ? `all ${type} documents` : "all documents";

  return [{ channel: "content", entries: [`Reviewing ${scope}...`] }];
};

export default evalHeadlineView;
