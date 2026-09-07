import type { EvalSummary, Finding, ReviewedTarget, Verdict } from "@/types.js";
import type { View } from "@framework/types.js";

/** The two shapes `eval run --json` can end in. */
type EvalJsonData =
  | { kind: "targets"; targets: ReviewedTarget[] }
  | { kind: "corpus"; summary: EvalSummary; cacheStats: { hits: number; misses: number } };

/**
 * The machine contract for `eval run --json` (08-g, 09-af): the run's
 * outcome as stable JSON on stdout, nothing else. Findings are compact
 * by reference (09): a matched finding carries its axiom id and
 * statement — the agent that wants examples runs `axioms show <id>`.
 */
const evalJsonView: View<EvalJsonData> = (data) => {
  return [{ channel: "content", entries: [JSON.stringify(payloadOf(data), null, 2)] }];
};

export default evalJsonView;

/** One mode's payload. */
function payloadOf(data: EvalJsonData): object {
  if (data.kind === "targets") {
    return { mode: "targets", targets: data.targets.map(targetJson) };
  }

  return { mode: "corpus", summary: data.summary, cache: data.cacheStats };
}

/** One fast-loop target: status, reason, and the deduplicated findings. */
function targetJson(target: ReviewedTarget): object {
  return {
    path: target.path,
    status: statusOf(target.verdict),
    reason: target.verdict.reason,
    findings: target.findings.map(findingJson),
  };
}

/** The match-state feedback shape (08-d): axiom reference or raw critique. */
function findingJson(finding: Finding): object {
  return {
    axiom_id: finding.axiomId,
    channel: finding.axiomId === null ? "open" : "matched",
    text: finding.text,
    severity: finding.severity,
    witnesses: finding.witnesses,
  };
}

/** A verdict folded to the wire status vocabulary. */
function statusOf(verdict: Verdict & { unverified?: true }): string {
  if (verdict.unverified) return "unverified";

  if (verdict.compliant) return "pass";

  return verdict.severity === "error" ? "fail" : "warn";
}
