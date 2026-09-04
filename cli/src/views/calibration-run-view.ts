import type { LedgerCalibrationRecord } from "@/types.js";
import type { DisplayEntry, View } from "@framework/types.js";

import { rateCell } from "@/helpers/metrics-helper.js";

/**
 * One reviewer's calibration record, rendered under the metrics rules
 * (07): agreement and per-axiom precision/recall as rate cells —
 * denominators always, floors as "insufficient data" — plus drift flags
 * and what the run cost.
 */
const calibrationRunView: View<LedgerCalibrationRecord> = (record) => {
  const opportunities = record.case_count * record.repeats;
  const agreement = rateCell(record.verdict_matches, opportunities);
  const scoreEntries = record.axiom_scores.map(scoreLine);

  const driftEntry =
    record.drift_flagged.length > 0
      ? {
          text: `drift: ${record.drift_flagged.join(", ")} moved beyond the threshold — trend lines annotate this boundary (06)`,
          color: "yellow" as const,
        }
      : null;
  const unverifiedEntry =
    record.unverified_count > 0
      ? { text: `unverified: ${record.unverified_count} (counted as disagreement)`, color: "red" as const }
      : null;

  const costEntries = [
    record.cost_usd !== null ? `cost: $${record.cost_usd.toFixed(4)}` : null,
  ].filter((entry): entry is string => entry !== null);

  const entries: DisplayEntry[] = [
    "",
    `verdict agreement: ${agreement.display}`,
    unverifiedEntry,
    ...scoreEntries,
    driftEntry,
    ...costEntries,
  ];

  return [
    {
      channel: "heading",
      text: `Calibration — ${record.reviewer_name} · ${record.case_count} case(s) × ${record.repeats}`,
    },
    { channel: "content", entries },
  ];
};

export default calibrationRunView;

/** One axiom's precision/recall line from its stored counts. */
function scoreLine(score: LedgerCalibrationRecord["axiom_scores"][number]): string {
  const precision = rateCell(
    score.true_positives,
    score.true_positives + score.false_positives,
  );
  const recall = rateCell(score.true_positives, score.true_positives + score.false_negatives);
  const varianceLabel = score.variance !== null ? ` · variance ${score.variance.toFixed(2)}` : "";

  return `${score.axiom_id}: precision ${precision.display} · recall ${recall.display} · FP ${score.false_positives}${varianceLabel}`;
}
