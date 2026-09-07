import type { View } from "@framework/types.js";

/** What a merge did, counted. */
interface MergeReport {
  survivorId: string;
  survivorStatement: string;
  /** Critiques moved per merged-away axiom. */
  moved: { axiomId: string; count: number }[];
  /** The survivor's population clock after the merge. */
  introduced: string;
  introducedChanged: boolean;
}

/**
 * A merge's outcome (04): what folded into the survivor, what its
 * clock is now, and the reminder that nothing was rewritten.
 */
const mergeReportView: View<MergeReport> = (report) => {
  const movedLines = report.moved.map(
    ({ axiomId, count }) => `  ${axiomId}: deprecated, ${count} critique(s) re-labeled`,
  );
  const total = report.moved.reduce((sum, entry) => sum + entry.count, 0);

  return [
    { channel: "heading", text: `Merged into ${report.survivorId}` },
    {
      channel: "content",
      entries: [
        report.survivorStatement,
        "",
        ...movedLines,
        `${total} critique(s) now count under ${report.survivorId} — prior labels stay in the ledger beneath the merge records.`,
        report.introducedChanged
          ? `Population clock: introduced moves to ${report.introduced} (the earliest among the merged).`
          : `Population clock unchanged: ${report.introduced}.`,
        "Reports recompute from the join — no history was rewritten.",
      ],
    },
  ];
};

export default mergeReportView;
