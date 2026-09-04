// The ledger's record shapes (05): append-only, committed, full
// provenance. Runs and critiques in one partition, triage decisions in
// the other.

import type { ProviderUsage } from "@/types/extension-points.js";
import type { Critique } from "@/types/review.js";
import type { Severity } from "@/types/shared.js";

/** What caused a ledger run (05). M2 writes only "manual". */
export type LedgerTrigger = "manual" | "ci" | "watch";

/** What a run covered (05). M2 writes "corpus" (full run) or "files" (named). */
export type LedgerScope = "corpus" | "diff" | "files";

/** Reviewer calibration state stamped on a run (06 grows this union). */
export type CalibrationStatus = "uncalibrated";

/** Verdict-diff classification of a critique (01). Null: no diff comparison existed. */
export type LedgerFlow = "introduced" | "inherited" | "resolved";

/**
 * A diff run's facts (12, flagged 05 addition, forward-only): what the
 * branch was measured against, and how much changed work the specs
 * could even see (01: the report must say how much work was invisible).
 */
export interface LedgerDiffFacts {
  /** The ref the base was resolved from (e.g. "origin/main"). */
  base_ref: string;
  /** The merge-base sha the before side was read at. */
  base_sha: string;
  /** The sha whose tree the after side was read at (git show, not disk). */
  head_sha: string;
  /** Files the range changed, before coverage filtering. */
  changed_files: number;
  /** Changed files a spec governs — the reviewed subset. */
  covered: number;
  uncovered_count: number;
  /** Project-relative paths no spec governs — the invisible work. */
  uncovered_paths: string[];
  /** Resolved events this run recorded (flow: "resolved" records). */
  resolved_count: number;
}

/**
 * One run record — one per (invocation, reviewer) — as stored.
 *
 * `reviewer_hash` goes beyond 05's field list deliberately: epochs are
 * promised to be derivable from provenance, and only the behavioral hash
 * sees a temperature, prompt, or options change. `baseline` is always
 * false until the epoch machinery exists (02).
 */
export interface LedgerRunRecord {
  kind: "run";
  run_id: string;
  timestamp: string;
  commit_sha: string | null;
  branch: string | null;
  trigger: LedgerTrigger;
  scope: LedgerScope;
  files_evaluated: number;
  reviewer_name: string;
  reviewer_model: string;
  reviewer_hash: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cost_usd: number | null;
  cache_hits: number;
  cache_misses: number;
  pass_count: number;
  warn_count: number;
  fail_count: number;
  unverified_count: number;
  critique_count: number;
  /**
   * Evaluated units per governing spec — the applicable-opportunity
   * denominator (07, added 2026-09-03). Absent on records written
   * before it existed; their per-run rates suppress as insufficient
   * data rather than padding.
   */
  spec_units?: Record<string, number>;
  /** Present on scope "diff" runs only (12, forward-only). */
  diff?: LedgerDiffFacts;
  calibration_status_at_run: CalibrationStatus;
  baseline: boolean;
}

/**
 * One critique record — one per issue — as stored.
 *
 * Fields no M2 run can know are typed literal `null`, so populating one
 * later is a visible type change, not a quiet drift. The enums a future
 * reader must understand (`population`, `authorship`, `flow`) carry their
 * full unions now, because old records outlive new code.
 */
export interface LedgerCritiqueRecord {
  kind: "critique";
  /** `${run_id}:${seq}`, 1-based in write order. */
  id: string;
  run_id: string;
  timestamp: string;
  /** Project-relative. */
  file_path: string;
  /** Project-relative. */
  spec_path: string;
  target_content_hash: string;
  spec_content_hash: string;
  reviewer_name: string;
  reviewer_model: string;
  reviewer_hash: string;
  severity: Severity;
  text: string;
  mode: "judgment";
  /** The checklist axiom the critique was born under; null = open channel. */
  axiom_id: string | null;
  axiom_version: number | null;
  /** How the assignment happened; "checklist" = born matched (04-t). */
  assigned_by: "checklist" | null;
  /** M2 writes "unknown" — never guessed (05). */
  population: "pre_spec" | "post_spec" | "unknown";
  /** M2 writes "unknown" — never guessed (02). */
  authorship: "agent" | "human" | "unknown";
  authorship_evidence: null;
  agent_involved: null;
  pre_review: null;
  /** Set-difference label on diff runs (12); null elsewhere — working-tree runs are feedback, never measurement. */
  flow: LedgerFlow | null;
  /** The run supplying the before-side verdict: this run's id when freshly reviewed, null on a cache hit (a cache entry carries no run identity — never guessed). */
  before_run_id: string | null;
  /** Resolved events only: the most recent git author touching the file in base..head. */
  resolved_by: string | null;
}

/** Any line of a run file. */
export type LedgerRecord = LedgerRunRecord | LedgerCritiqueRecord;

/** What one review produced beyond its verdict — null when nothing was reviewed. */
export interface LedgerEvidence {
  /** Provider usage, or null on a cache hit. */
  usage: ProviderUsage | null;
  /** Absolute path of the spec the unit was reviewed against. */
  specPath: string;
  targetContentHash: string;
  specContentHash: string;
}

/** One reviewed unit as the ledger sees it. */
export interface LedgerEntry {
  /** The structural slice of a verdict the ledger reads. */
  verdict: {
    path: string;
    compliant: boolean;
    issues: Critique[];
    severity?: Severity;
    unverified?: true;
  };
  cacheHit: boolean;
  /** Null ⇒ the unit went unverified ⇒ it fans out no critiques. */
  evidence: LedgerEvidence | null;
  /** Flow label per issue, parallel to `verdict.issues` (diff runs only). */
  flow?: (LedgerFlow | null)[];
  /**
   * Who supplied the before-side verdict: "self" when this run freshly
   * reviewed it (the write service substitutes the minted run id),
   * null on a cache hit. Absent outside diff runs.
   */
  beforeRunId?: "self" | null;
}

/** Where a run landed. */
export interface WriteLedgerRunResult {
  runId: string;
  path: string;
}

/** A human decision folding one critique into an axiom (04-t). */
export interface TriageAssignmentRecord {
  kind: "assignment";
  critique_id: string;
  axiom_id: string;
  axiom_version: number;
  /** Both halves of the provenance: who decided, who suggested. */
  assigned_by: { decision: "human" | "flag:--yes"; suggested_by: string };
  timestamp: string;
}

/** A human decision that a critique is not evidence worth keeping. */
export interface TriageDismissalRecord {
  kind: "dismissal";
  critique_id: string;
  reason: string;
  timestamp: string;
}

/** A proposal rejected at ratification — reviewer-noise signal (04). */
export interface ProposalRejectionRecord {
  kind: "rejection";
  axiom_id: string;
  reason: string;
  timestamp: string;
}

/** Everything a triage session appends. */
export type TriageRecord = TriageAssignmentRecord | TriageDismissalRecord | ProposalRejectionRecord;

/** One unassigned open-channel critique, as triage works it. */
export interface PendingCritique {
  id: string;
  runId: string;
  /** Project-relative, as the ledger records them. */
  filePath: string;
  specPath: string;
  severity: Severity;
  text: string;
  reviewerName: string;
}
