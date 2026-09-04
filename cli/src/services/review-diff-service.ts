import type { PraxisConfig } from "@/models/praxis-config.js";
import type {
  Critique,
  DiffTarget,
  DiffTargetOutcome,
  FlowSide,
  LedgerEntry,
  ResolveDiffResult,
  ResolvedEvent,
  ReviewDiffInput,
  ReviewDiffResult,
  ReviewedSide,
  ReviewerConfig,
  Service,
  Verdict,
} from "@/types.js";

import { lastAuthorOfRange, showFileAt } from "@/helpers/git-helper.js";
import { relativePath } from "@/helpers/paths-helper.js";
import { ReviewSubject } from "@/models/review-subject.js";
import { Reviewer } from "@/models/reviewer.js";
import computeFlowService from "@/services/compute-flow-service.js";
import reviewTargetService from "@/services/review-target-service.js";
import writeLedgerRunService from "@/services/write-ledger-run-service.js";
import { AxiomStore } from "@/stores/axiom-store.js";
import { VerdictStore } from "@/stores/verdict-store.js";

/**
 * One `praxis eval run --diff`: both sides of every covered changed
 * file, reviewed by every selected reviewer, flow-labeled (12).
 *
 * Both sides are read from git — the after side at the head sha, the
 * before side at the merge-base — never from disk, so a dirty tree
 * cannot leak into a measured run and reruns are idempotent snapshots.
 * Each side is reviewed as an ordinary target through the same cache
 * every run uses: the before side is usually a hit (its content was
 * reviewed on the base branch), so a diff costs about one reviewer
 * call per changed file (01). Flow is then mechanical set-difference
 * per file (`compute-flow-service`), and provenance is shared across
 * the comparison by construction — same spec, checklist, and reviewer
 * within one invocation.
 *
 * A target either side of which cannot be reviewed is `unverified`:
 * its flow is withheld entirely, because a one-sided comparison is not
 * a comparison — never raised, never a violation (03).
 *
 * Each reviewer's pass persists to the ledger with `scope: "diff"`,
 * the diff facts, and one resolved event per vanished violation,
 * unless `ledger: false`.
 */
const reviewDiffService: Service<ReviewDiffInput, Promise<ReviewDiffResult>> = async (
  cfg,
  { reviewers, diff, useCache = true, readOnlyCache = false, ledger = true, onProgress },
) => {
  const perTarget: DiffTargetOutcome[] = [];
  const cacheStats = { hits: 0, misses: 0 };
  const summary = { introduced: 0, resolved: 0, inherited: 0, errorsIntroduced: 0, unverified: 0 };

  const specUnits: Record<string, number> = {};

  for (const target of diff.targets) {
    if (target.status === "deleted") continue;

    const specKey = relativePath(cfg.root, target.specPath);
    specUnits[specKey] = (specUnits[specKey] ?? 0) + 1;
  }

  const total = diff.targets.length * reviewers.length;
  let index = 0;

  for (const reviewerConfig of reviewers) {
    const reviewer = Reviewer.fromConfig(reviewerConfig);
    // The persistent cache holds ONE entry per (target, spec, reviewer):
    // the current state. The before side reads it — the base branch's
    // runs are what make a diff ~one call per file (01) — but never
    // writes it, or the two sides would thrash the entry; the after
    // side writes last, leaving the cache at HEAD state, which is
    // exactly what the next corpus run on this tree expects.
    const beforeCache = useCache
      ? new VerdictStore(cfg, { reviewer: reviewer.cacheIdentity(), readOnly: true })
      : null;
    const afterCache = useCache
      ? new VerdictStore(cfg, { reviewer: reviewer.cacheIdentity(), readOnly: readOnlyCache })
      : null;

    const entries: LedgerEntry[] = [];
    const resolvedEvents: ResolvedEvent[] = [];

    for (const target of diff.targets) {
      index++;
      onProgress?.({
        kind: "unit-start",
        index,
        total,
        path: target.path,
        reviewerName: reviewers.length > 1 ? reviewerConfig.name : undefined,
      });

      const outcome = await reviewBothSides(cfg, {
        target,
        diff,
        reviewer,
        reviewerConfig,
        beforeCache,
        afterCache,
        cacheStats,
      });

      perTarget.push(outcome.result);
      tally(summary, outcome.result);

      if (outcome.afterEntry) {
        entries.push(outcome.afterEntry);
      }

      if (outcome.afterVerdict) {
        onProgress?.({ kind: "verdict", verdict: outcome.afterVerdict });
      }

      resolvedEvents.push(...outcome.resolved);
    }

    if (ledger && (entries.length > 0 || resolvedEvents.length > 0)) {
      writeLedgerRunService(cfg, {
        reviewer: reviewer.cacheIdentity(),
        trigger: "manual",
        scope: "diff",
        entries,
        specUnits,
        diff: {
          facts: {
            base_ref: diff.baseRef,
            base_sha: diff.baseSha,
            head_sha: diff.headSha,
            changed_files: diff.targets.length + diff.uncovered.length,
            covered: diff.targets.length,
            uncovered_count: diff.uncovered.length,
            uncovered_paths: diff.uncovered,
          },
          resolved: resolvedEvents,
        },
      });
    }
  }

  return { perTarget, summary, cacheStats };
};

export default reviewDiffService;

/**
 * One target under one reviewer: after side, before side, flow. Any
 * failure on either side makes the target unverified with flow
 * withheld — one unreadable side must not mint false introductions.
 */
async function reviewBothSides(
  cfg: PraxisConfig,
  input: {
    target: DiffTarget;
    diff: ResolveDiffResult;
    reviewer: Reviewer;
    reviewerConfig: ReviewerConfig;
    beforeCache: VerdictStore | null;
    afterCache: VerdictStore | null;
    cacheStats: { hits: number; misses: number };
  },
): Promise<{
  result: DiffTargetOutcome;
  afterEntry: LedgerEntry | null;
  afterVerdict: Verdict | null;
  resolved: ResolvedEvent[];
}> {
  const { target, diff, reviewer, reviewerConfig, beforeCache, afterCache, cacheStats } = input;

  try {
    const before = await reviewSide(cfg, {
      sha: diff.baseSha,
      target,
      absent: target.status === "added",
      reviewer,
      cache: beforeCache,
      cacheStats,
    });
    const after = await reviewSide(cfg, {
      sha: diff.headSha,
      target,
      absent: target.status === "deleted",
      reviewer,
      cache: afterCache,
      cacheStats,
    });

    const flow = computeFlowService(cfg, {
      before: before ? flowSide(before, reviewer) : null,
      after: after ? flowSide(after, reviewer) : null,
    });

    const severityByAxiom = new Map(
      (after?.subject.checklist ?? []).map((axiom) => [axiom.id, axiom.severity]),
    );
    const findings = (after?.verdict.issues ?? []).map((critique, at) => ({
      critique,
      flow: flow.afterFlow[at] ?? null,
      severity: severityFor(critique, severityByAxiom, after?.verdict.severity),
    }));

    const resolved: ResolvedEvent[] = before
      ? flow.resolved.map((critique) => ({
          filePath: target.relPath,
          specPath: target.specPath,
          targetContentHash: before.subject.targetContentHash(),
          specContentHash: before.subject.specContentHash(),
          critique,
          severity: before.verdict.severity ?? "error",
          resolvedBy: lastAuthorOfRange(cfg.root, diff.baseSha, diff.headSha, target.relPath),
        }))
      : [];

    const afterEntry: LedgerEntry | null = after
      ? {
          verdict: {
            path: target.path,
            compliant: after.verdict.compliant,
            issues: after.verdict.issues,
            severity: after.verdict.severity,
          },
          cacheHit: after.cacheHit,
          evidence: {
            usage: after.usage,
            specPath: target.specPath,
            targetContentHash: after.subject.targetContentHash(),
            specContentHash: after.subject.specContentHash(),
          },
          flow: flow.afterFlow,
          beforeRunId: before === null || before.cacheHit ? null : "self",
        }
      : null;

    return {
      result: {
        relPath: target.relPath,
        reviewerName: reviewerConfig.name,
        status: target.status,
        findings,
        resolved: flow.resolved,
        unverified: false,
      },
      afterEntry,
      afterVerdict: after?.verdict ?? null,
      resolved,
    };
  } catch {
    return {
      result: {
        relPath: target.relPath,
        reviewerName: reviewerConfig.name,
        status: target.status,
        findings: [],
        resolved: [],
        unverified: true,
      },
      afterEntry: null,
      afterVerdict: null,
      resolved: [],
    };
  }
}

/**
 * One side reviewed as an ordinary target, or null when the file does
 * not exist on that side (added / deleted).
 *
 * @throws when the side should exist but cannot be read or reviewed —
 *   the caller turns that into an unverified target
 */
async function reviewSide(
  cfg: PraxisConfig,
  input: {
    sha: string;
    target: DiffTarget;
    absent: boolean;
    reviewer: Reviewer;
    cache: VerdictStore | null;
    cacheStats: { hits: number; misses: number };
  },
): Promise<ReviewedSide | null> {
  const { sha, target, absent, reviewer, cache, cacheStats } = input;

  if (absent) return null;

  const content = showFileAt(cfg.root, sha, target.relPath);

  if (content === null) {
    throw new Error(`${target.relPath} is unreadable at ${sha.slice(0, 7)}`);
  }

  const subject = ReviewSubject.resolve({
    targetPath: target.path,
    targetContent: content,
    specPath: target.specPath,
    root: cfg.root,
    checklistFor: (spec) => new AxiomStore(cfg).checklistFor(spec),
  });

  const { verdict, cacheHit, usage } = await reviewTargetService(cfg, {
    target: subject,
    reviewer,
    cache,
  });

  if (cacheHit) cacheStats.hits++;
  else cacheStats.misses++;

  return { subject, verdict, cacheHit, usage };
}

/** A finding's severity: its axiom's when matched, the verdict's otherwise. */
function severityFor(
  critique: Critique,
  severityByAxiom: Map<string, "error" | "warning">,
  verdictSeverity: "error" | "warning" | undefined,
): "error" | "warning" {
  if (critique.axiomId !== null) {
    return severityByAxiom.get(critique.axiomId) ?? verdictSeverity ?? "error";
  }

  return verdictSeverity ?? "error";
}

/** One side's comparison-facing slice. */
function flowSide(side: ReviewedSide, reviewer: Reviewer): FlowSide {
  return {
    issues: side.verdict.issues,
    specContentHash: side.subject.specContentHash(),
    reviewerHash: reviewer.hash(),
  };
}

/** Adds one target's outcome into the run summary. */
function tally(summary: ReviewDiffResult["summary"], outcome: DiffTargetOutcome): void {
  if (outcome.unverified) {
    summary.unverified++;
    return;
  }

  for (const finding of outcome.findings) {
    if (finding.flow === "introduced") {
      summary.introduced++;

      if (finding.severity === "error") summary.errorsIntroduced++;
    }

    if (finding.flow === "inherited") summary.inherited++;
  }

  summary.resolved += outcome.resolved.length;
}
