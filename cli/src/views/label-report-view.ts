import type { ProviderUsage } from "@/types.js";
import type { DisplayEntry, View } from "@framework/types.js";

import { duration } from "@framework/views/duration.js";
import { statLines } from "@framework/views/stats.js";

/** What the labeling pass reports. */
interface LabelReportData {
  labels: { critiqueId: string; axiomId: string }[];
  /** Labels per axiom, sorted by id — computed by the service. */
  labeledByAxiom: { axiomId: string; count: number }[];
  /** Critiques the matcher considered and could not label — curate's queue now. */
  sentToCurate: number;
  skippedNoAxioms: number;
  /** Labeling calls that failed — their critiques stay untriaged. */
  failed: number;
  usage: ProviderUsage | null;
  /** Wall-clock the pass took. */
  elapsedMs: number;
  sessionPath: string | null;
  dryRun: boolean;
}

/**
 * The labeling pass, summarized: one count per line, the per-axiom
 * tally as its own block, and what to do next.
 */
const labelReportView: View<LabelReportData> = (data) => {
  const counts: [string, string | number][] = [
    ["Labeled", data.labels.length],
    ["Sent to curate", data.sentToCurate + data.skippedNoAxioms],
  ];

  if (data.failed > 0) counts.push(["Failed", data.failed]);

  const axiomLines = data.labeledByAxiom.map(
    (tally) => `  ${tally.axiomId}  ${tally.count} critique(s)`,
  );

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
    "",
    spendLine(data.usage, data.elapsedMs),
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

/**
 * What the pass took, and what it cost when a curator was called.
 *
 * The time always shows; the cost only when something was actually
 * spent, because "$0.0000" would claim a measurement never taken.
 */
function spendLine(usage: ProviderUsage | null, elapsedMs: number): string {
  const time = `Time: ${duration(elapsedMs)}`;

  if (usage?.costUsd === null || usage?.costUsd === undefined) return time;

  return `${time} · Curator cost: $${usage.costUsd.toFixed(4)}`;
}
