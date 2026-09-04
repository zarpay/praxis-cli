import type {
  Critique,
  DiffTargetOutcome,
  EvalSummary,
  Finding,
  ReviewDiffResult,
  ReviewedTarget,
  Verdict,
} from "@/types.js";
import type { View } from "@framework/types.js";

/** The three shapes `eval run --json` can end in. */
type EvalJsonData =
  | { kind: "targets"; targets: ReviewedTarget[] }
  | { kind: "corpus"; summary: EvalSummary; cacheStats: { hits: number; misses: number } }
  | {
      kind: "diff";
      result: ReviewDiffResult;
      base?: string;
      head?: string;
      uncovered?: string[];
    };

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

  if (data.kind === "corpus") {
    return { mode: "corpus", summary: data.summary, cache: data.cacheStats };
  }

  return {
    mode: "diff",
    base: data.base ?? null,
    head: data.head ?? null,
    uncovered: data.uncovered ?? [],
    summary: data.result.summary,
    cache: data.result.cacheStats,
    targets: data.result.perTarget.map(diffTargetJson),
  };
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

/** One diff target with its flow labels and resolutions. */
function diffTargetJson(outcome: DiffTargetOutcome): object {
  return {
    path: outcome.relPath,
    reviewer: outcome.reviewerName,
    status: outcome.status,
    unverified: outcome.unverified,
    unverified_reason: outcome.unverifiedReason,
    findings: outcome.findings.map((finding) => ({
      axiom_id: finding.critique.axiomId,
      text: finding.critique.text,
      severity: finding.severity,
      flow: finding.flow,
    })),
    resolved: outcome.resolved.map((critique: Critique) => ({
      axiom_id: critique.axiomId,
      text: critique.text,
    })),
  };
}

/** A verdict folded to the wire status vocabulary. */
function statusOf(verdict: Verdict & { unverified?: true }): string {
  if (verdict.unverified) return "unverified";

  if (verdict.compliant) return "pass";

  return verdict.severity === "error" ? "fail" : "warn";
}
