import type {
  LedgerCritiqueRecord,
  LedgerEntry,
  LedgerRecord,
  LedgerRunRecord,
  ProviderUsage,
  Service,
  WriteLedgerRunInput,
  WriteLedgerRunResult,
} from "@/types.js";

import { gitFacts } from "@/helpers/git-helper.js";
import { relativePath } from "@/helpers/paths-helper.js";
import { RunStore } from "@/stores/run-store.js";

/**
 * Persists one reviewer's completed run to the ledger (05).
 *
 * One file per run at `.praxis/ledger/runs/<run_id>.jsonl` — the run
 * record first, then one critique record per issue. The file is written
 * whole and never touched again: append-only means records are immutable,
 * and one-file-per-run keeps concurrent runs and git merges conflict-free.
 *
 * Cache hits and unverified units are counted on the run record but fan
 * out no critiques — nothing new was reviewed. A write failure throws:
 * an eval store with optional gaps is not an eval store.
 */
const writeLedgerRunService: Service<WriteLedgerRunInput, WriteLedgerRunResult> = (
  cfg,
  { reviewer, trigger, scope, entries, specUnits },
) => {
  const root = cfg.root;
  const runStore = new RunStore(cfg);
  const runId = runStore.mintRunId();
  const timestamp = new Date().toISOString();
  const { commitSha, branch } = gitFacts(root);

  const critiques: LedgerCritiqueRecord[] = [];

  for (const { verdict, cacheHit, evidence } of entries) {
    if (!evidence || cacheHit) continue;

    for (const issue of verdict.issues) {
      critiques.push({
        kind: "critique",
        id: `${runId}:${critiques.length + 1}`,
        run_id: runId,
        timestamp,
        file_path: relativePath(root, verdict.path),
        spec_path: relativePath(root, evidence.specPath),
        target_content_hash: evidence.targetContentHash,
        spec_content_hash: evidence.specContentHash,
        reviewer_name: reviewer.name,
        reviewer_model: reviewer.model,
        reviewer_hash: reviewer.hash,
        severity: verdict.severity ?? "error",
        text: stripControlChars(issue.text),
        mode: "judgment",
        // Born matched = assigned at review time by the checklist (04-t);
        // open-channel critiques stay null until triage assigns them.
        axiom_id: issue.axiomId,
        axiom_version: issue.axiomVersion,
        assigned_by: issue.axiomId === null ? null : "checklist",
        population: "unknown",
        authorship: "unknown",
        authorship_evidence: null,
        agent_involved: null,
        pre_review: null,
        flow: null,
        before_run_id: null,
        resolved_by: null,
      });
    }
  }

  const run: LedgerRunRecord = {
    kind: "run",
    run_id: runId,
    timestamp,
    commit_sha: commitSha,
    branch,
    trigger,
    scope,
    files_evaluated: entries.length,
    reviewer_name: reviewer.name,
    reviewer_model: reviewer.model,
    reviewer_hash: reviewer.hash,
    ...usageTotals(entries),
    cache_hits: entries.filter((entry) => entry.cacheHit).length,
    cache_misses: entries.filter((entry) => !entry.cacheHit && entry.evidence).length,
    ...verdictCounts(entries),
    critique_count: critiques.length,
    ...(specUnits && { spec_units: specUnits }),
    calibration_status_at_run: "uncalibrated",
    baseline: isBaseline(runStore, scope, reviewer.hash),
  };

  const records: LedgerRecord[] = [run, ...critiques];

  return runStore.writeRun(runId, records);
};

export default writeLedgerRunService;

/**
 * Whether this run opens its reviewer's epoch (02): the first full run
 * under a behavioral hash no prior corpus run carries. A files-scope
 * fast loop never claims baseline — an epoch without an opening full
 * run has no denominator.
 */
function isBaseline(runStore: RunStore, scope: string, reviewerHash: string): boolean {
  if (scope !== "corpus") return false;

  return !runStore.hasCorpusRun(reviewerHash);
}

/** Per-field usage sums; a field nothing reported stays null. */
function usageTotals(entries: LedgerEntry[]): {
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cost_usd: number | null;
} {
  const usages = entries
    .map((entry) => entry.evidence?.usage)
    .filter((usage): usage is ProviderUsage => Boolean(usage));

  const sum = (field: keyof ProviderUsage) => {
    const reported = usages
      .map((usage) => usage[field])
      .filter((value): value is number => value !== null);

    return reported.length === 0 ? null : reported.reduce((total, value) => total + value, 0);
  };

  return {
    prompt_tokens: sum("promptTokens"),
    completion_tokens: sum("completionTokens"),
    cost_usd: sum("costUsd"),
  };
}

/** The run's outcome tallies, cache hits included; unverified is never a violation. */
function verdictCounts(entries: LedgerEntry[]): {
  pass_count: number;
  warn_count: number;
  fail_count: number;
  unverified_count: number;
} {
  let pass = 0;
  let warn = 0;
  let fail = 0;
  let unverified = 0;

  for (const { verdict } of entries) {
    if (verdict.unverified) unverified++;
    else if (verdict.compliant) pass++;
    else if (verdict.severity === "warning") warn++;
    else fail++;
  }

  return { pass_count: pass, warn_count: warn, fail_count: fail, unverified_count: unverified };
}

/** Critique text is stored verbatim, minus control characters. */
function stripControlChars(text: string): string {
  // eslint-disable-next-line no-control-regex -- stripping them is the point
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}
