import type { Verdict } from "@/domains/eval/types.js";

/**
 * The worst of several verdicts, or null when there are none.
 *
 * How a target reviewed by several reviewers gets one outcome: any error
 * outranks any warning, which outranks a pass. Reviewers are separate
 * instruments and may disagree, so the run reports the most serious thing
 * any of them said rather than a consensus.
 */
export default function worstVerdictService(verdicts: Verdict[]): Verdict | null {
  return verdicts.reduce<Verdict | null>(
    (worst, verdict) => (!worst || severityRank(verdict) > severityRank(worst) ? verdict : worst),
    null,
  );
}

/**
 * Orders one verdict: pass < warning < error.
 *
 * A compliant verdict is lowest regardless of what severity it carries,
 * because severity only describes a failure.
 */
function severityRank(verdict: Verdict): number {
  if (verdict.compliant) return 0;

  return verdict.severity === "warning" ? 1 : 2;
}
