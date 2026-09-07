import type { ProviderUsage } from "@/types.js";
import type { DisplayEntry, View } from "@framework/types.js";

/** What the labeling pass reports. */
interface LabelReportData {
  labels: { critiqueId: string; axiomId: string }[];
  leftPending: number;
  skippedNoAxioms: number;
  /** Labeling calls that failed — their critiques stay pending. */
  failed: number;
  usage: ProviderUsage | null;
  sessionPath: string | null;
  dryRun: boolean;
}

/**
 * The labeling pass, summarized: what got a label, what stays pending
 * for curate, and what had no axioms to label against.
 */
const labelReportView: View<LabelReportData> = (data) => {
  const byAxiom = new Map<string, number>();

  for (const label of data.labels) {
    byAxiom.set(label.axiomId, (byAxiom.get(label.axiomId) ?? 0) + 1);
  }

  const axiomLines = [...byAxiom.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([axiomId, count]) => `  ${axiomId}: ${count} critique(s)`);

  const costLine =
    data.usage?.costUsd !== null && data.usage?.costUsd !== undefined
      ? `curator cost $${data.usage.costUsd.toFixed(4)}`
      : null;

  const entries: DisplayEntry[] = [
    `Labeled: ${data.labels.length} · Left pending: ${data.leftPending}` +
      (data.skippedNoAxioms > 0 ? ` · No axioms to label against: ${data.skippedNoAxioms}` : ""),
    ...axiomLines,
    data.failed > 0
      ? `${data.failed} labeling call(s) failed — their critiques stay pending; rerun triage to retry.`
      : null,
    costLine,
    data.leftPending > 0
      ? "The residue is for humans: `praxis axioms curate` clusters, dismisses, and assigns it."
      : null,
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
