import type { ProviderUsage } from "@/types.js";
import type { DisplayEntry, View } from "@framework/types.js";

import { statLines } from "@framework/views/stats.js";

/** What the labeling pass reports. */
interface LabelReportData {
  labels: { critiqueId: string; axiomId: string }[];
  /** Critiques the matcher considered and could not label — curate's queue now. */
  sentToCurate: number;
  skippedNoAxioms: number;
  /** Labeling calls that failed — their critiques stay untriaged. */
  failed: number;
  usage: ProviderUsage | null;
  sessionPath: string | null;
  dryRun: boolean;
}

/**
 * The labeling pass, summarized: one count per line, the per-axiom
 * tally as its own block, and what to do next.
 */
const labelReportView: View<LabelReportData> = (data) => {
  const byAxiom = new Map<string, number>();

  for (const label of data.labels) {
    byAxiom.set(label.axiomId, (byAxiom.get(label.axiomId) ?? 0) + 1);
  }

  const counts: [string, string | number][] = [
    ["Labeled", data.labels.length],
    ["Sent to curate", data.sentToCurate + data.skippedNoAxioms],
  ];

  if (data.failed > 0) counts.push(["Failed", data.failed]);

  const axiomLines = [...byAxiom.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([axiomId, count]) => `  ${axiomId}  ${count} critique(s)`);

  const entries: DisplayEntry[] = [
    ...statLines(counts),
    ...(axiomLines.length > 0 ? ["", "Labeled under:", ...axiomLines] : []),
    ...(data.skippedNoAxioms > 0
      ? ["", `${data.skippedNoAxioms} critique(s) had no active axioms to label against.`]
      : []),
    ...(data.failed > 0
      ? [
          "",
          `${data.failed} labeling call(s) failed — their critiques stay untriaged; rerun triage to retry.`,
        ]
      : []),
    ...(costLine(data.usage) ? ["", costLine(data.usage)] : []),
    ...(data.sentToCurate + data.skippedNoAxioms > 0
      ? ["", "Next: `praxis axioms curate` works the unmatched critiques — cluster, assign, hold."]
      : []),
  ];

  return [
    {
      channel: data.dryRun ? "warning" : "heading",
      text: data.dryRun ? "Dry run — nothing was written" : "Triage — the labeling pass",
    },
    { channel: "content", entries },
  ];
};

export default labelReportView;

/** Curator spend, when reported. */
function costLine(usage: ProviderUsage | null): string | null {
  if (usage?.costUsd === null || usage?.costUsd === undefined) return null;

  return `Curator cost: $${usage.costUsd.toFixed(4)}`;
}
