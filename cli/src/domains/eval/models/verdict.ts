import type { Verdict } from "@/domains/eval/types.js";

/**
 * Orders verdicts worst-first: pass < warning < error.
 *
 * How a target with several reviewers gets one outcome — any error
 * outranks any warning, which outranks a pass. A compliant verdict is
 * lowest regardless of what severity it carries, because severity only
 * describes a failure.
 */
export function severityRank(verdict: Verdict): number {
  if (verdict.compliant) return 0;

  return verdict.severity === "warning" ? 1 : 2;
}

/** The worst of several verdicts, or null when there are none. */
export function worstVerdict(verdicts: Verdict[]): Verdict | null {
  return verdicts.reduce<Verdict | null>(
    (worst, verdict) => (!worst || severityRank(verdict) > severityRank(worst) ? verdict : worst),
    null,
  );
}
