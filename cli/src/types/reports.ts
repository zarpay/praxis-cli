// The measurement read-side: epochs, populations, rates, and the
// report payloads — every one a stable --json contract.

import type { AxiomStatus } from "@/types/axioms.js";
import type { LedgerCritiqueRecord, LedgerRunRecord } from "@/types/ledger.js";
import type { Severity } from "@/types/shared.js";

/** Structured report of project health. */
export interface StatusReport {
  /**
   * Whether the spec-layer compiler is in use (the experts directory
   * exists). Framework health only surfaces when it is: eval-only
   * projects are never asked about a taxonomy they don't have.
   */
  compilerInUse: boolean;
  /** Document counts by content type. */
  counts: {
    experts: number;
    practices: number;
    references: number;
    context: number;
  };
  /**
   * Cached verdict counts across all spec targets, one row per reviewer —
   * reviewers are separate instruments and are never silently pooled.
   * Empty when no reviewers are configured.
   */
  validation: {
    /** The reviewer's name, or null for the un-namespaced legacy cache. */
    reviewer: string | null;
    pass: number;
    warn: number;
    fail: number;
    notValidated: number;
  }[];
  /** Structural problems found in total — what maps to the exit code. */
  issueCount: number;
  /** The situational-poll facts an agent reads from one call. */
  evalState: {
    /** Untriaged critiques — `axioms triage` categorizes them. */
    pending_triage: number;
    /** Unmatched critiques — `axioms curate` works them. */
    awaiting_curation: number;
    proposals_pending: number;
    /** Always true: calibration is a roadmap feature. */
    calibration_stale: boolean;
    epoch_boundary_detected: boolean;
    last_run_at: string | null;
  };
  /** Expert files that failed validation, with the reason. */
  invalidExperts: { expert: string; reason: string }[];
  /** Practice files no expert references. */
  orphanedPractices: string[];
  /** Expert references pointing at files that do not exist. */
  danglingRefs: { expert: string; ref: string }[];
  /** Expert files missing the `description` frontmatter field. */
  expertsMissingDescription: string[];
  /** Expert glob references that match no files. */
  zeroMatchGlobs: { expert: string; pattern: string }[];
}

/** What the orientation screen shows — bare `praxis`. */
export interface Orientation {
  lastRun: { at: string; reviewerName: string; anchored: boolean } | null;
  pendingTriage: number;
  awaitingCuration: number;
  proposalsPending: number;
  activeAxioms: number;
  calibration: string;
  /** Errors at the latest corpus run, per reviewer. */
  debtLine: { reviewerName: string; errors: number }[] | null;
}

/**
 * One reviewer whose behavioral hash the ledger has never seen — an
 * epoch boundary. Named from the most recent prior run so the
 * warning can say what changed.
 */
export interface EpochBoundary {
  reviewerName: string;
  currentHash: string;
  currentModel: string;
  previousHash: string;
  previousModel: string;
  /** Timestamp of the reviewer's most recent prior run. */
  lastRunTimestamp: string;
}

/** One epoch: a maximal interval of stable reviewer behavior. */
export interface Epoch {
  reviewerHash: string;
  reviewerModel: string;
  /** Run ids in this epoch, in timestamp order. */
  runs: LedgerRunRecord[];
  /** The epoch-opening corpus run, when one exists. */
  baseline: LedgerRunRecord | null;
  /** How this epoch was opened; null for a reviewer's first epoch. */
  openedBy: EpochBoundaryEvent | null;
}

/** A named epoch boundary — first-class in every report. */
export interface EpochBoundaryEvent {
  /** "model → x/y" or "config or prompt surface changed". */
  label: string;
  /** Timestamp of the first run under the new hash. */
  at: string;
}

/** One reviewer's full epoch series, in first-seen order. */
export interface EpochSeries {
  reviewerName: string;
  epochs: Epoch[];
}

/** One rate, floor-aware: rendered only with its denominator. */
export interface RateCell {
  numerator: number;
  denominator: number;
  /** Null when the cell is below the small-n floor. */
  rate: number | null;
  /** "3/41 (7.3%)" or "insufficient data (n<5)". */
  display: string;
}

/** What population a count is qualified by (01; unqualified is banned). */
export type PopulationQualifier = "pre_spec" | "post_spec" | "unknown";

/** How one report invocation is scoped (files, commit, or PR set — plus filters). */
export interface ReportScope {
  /** Glob or path over critique file_paths; null = everything. */
  target: string | null;
  /** ISO date floor on run timestamps; null = all time. */
  since: string | null;
  branch: string | null;
  /** Exact run commit shas; null = any. */
  commits: string[] | null;
  /** Shas that no longer resolve in this clone (the missing-commit note renders). */
  unresolvableShas: { sha: string; branch: string | null; at: string | null }[];
}

/** Ledger records after scoping: what a report computes over. */
export interface ScopedLedger {
  scope: ReportScope;
  runs: LedgerRunRecord[];
  critiques: LedgerCritiqueRecord[];
}

/** One axiom's row in the eval report, one reviewer's series (07 rule 7). */
export interface AxiomReportRow {
  axiomId: string;
  statement: string;
  severity: Severity;
  reviewerName: string;
  /** Violations over applicable opportunities, floor-aware. */
  rate: RateCell;
  /**
   * When the current stock was last evidenced: the anchor run's
   * timestamp, or null when no evidenced corpus run exists. An all-hit
   * run restates no critiques, so it never moves this.
   */
  asOf: string | null;
  /** Distinct files violating. */
  files: number;
  /** Violation counts by derived population. */
  byPopulation: Record<PopulationQualifier, number>;
  /** Epoch segments, oldest first — never charted across a boundary. */
  segments: { epochLabel: string; violations: number; runs: number }[];
}

/** The eval report payload — the stable `--json` contract. */
export interface EvalReport {
  scope: ReportScope;
  /** The core panel: runs, critiques, cost across the scope. */
  panel: {
    runs: number;
    critiques: number;
    filesTouched: number;
    reviewers: string[];
    specs: string[];
    costUsd: number | null;
    /** Run-indexed cost trend with calendar annotations (07 open q1). */
    costTrend: { runId: string; at: string; costUsd: number | null }[];
  };
  /** "uncalibrated" until M6; rendered on every report (07 rule 4). */
  calibration: string;
  axioms: AxiomReportRow[];
  /** Untriaged critiques — the triage queue. */
  pendingTriage: number;
  /** Unmatched critiques — the curate queue. */
  awaitingCuration: number;
  /** Dismissed + rejected over all critiques, floor-aware. */
  residual: RateCell;
  epochs: EpochSeries[];
}

/** The single-axiom drill-down payload. */
export interface AxiomReport {
  axiomId: string;
  /** The per-reviewer calibration banner — carried on the payload like every other report. */
  calibration: string;
  statement: string;
  status: AxiomStatus;
  severity: Severity;
  derivedFrom: string | null;
  introduced: string;
  version: number;
  rows: AxiomReportRow[];
  /** Representative critiques, newest first, capped. */
  examples: { id: string; filePath: string; reviewerName: string; text: string }[];
}

/** The suggested — never verdicted — diagnosis of one axiom's evidence. */
export type HarnessDiagnosis =
  "harness_gap" | "spec_problem" | "reviewer_noise" | "insufficient_data";

/** One axiom's entry in the harness brief, per reviewer — never pooled. */
export interface HarnessBriefAxiom {
  axiom_id: string;
  statement: string;
  reviewer: string;
  /** The reviewer's current behavioral hash — the epoch the evidence belongs to. */
  epoch: string;
  introduction_rate: RateCell;
  debt_stock: number;
  paydown: number;
  /** Introduced vs resolved over the selected diffs, one line. */
  trend: string;
  /** 3-5 newest, linked to ledger ids. */
  representative_critiques: { id: string; text: string }[];
  suggested_diagnosis: HarnessDiagnosis;
  /** Why this diagnosis — triangulation is heuristic, so it shows its work. */
  diagnosis_reason: string;
}

/** The harness brief: evidence about which harness elements to change. */
export interface HarnessBrief {
  /** First and last run timestamps in scope; null when the ledger is empty. */
  period: { from: string | null; to: string | null };
  /** Introduced counts by population across the selected diff runs. */
  populations: Record<PopulationQualifier, number>;
  /** The per-reviewer calibration banner — an uninterpretable brief says so. */
  calibration: string;
  top_axioms: HarnessBriefAxiom[];
  /** Dismissed + rejected over all critiques — is the reviewer drifting off-spec? */
  residual_summary: string;
  /** Active axioms with no evidence in scope. */
  removal_candidates: string[];
  /** The standing guardrails, stated on every brief. */
  note: string;
}

/** One axiom's debt position in one reviewer's latest epoch. */
export interface DebtRow {
  axiomId: string;
  statement: string;
  reviewerName: string;
  /** (axiom, file) pairs violating at the epoch-opening baseline. */
  baselineStock: number;
  /** Violating at the latest corpus run of the epoch. */
  currentStock: number;
  /** In baseline, gone at latest — corpus-level paydown. */
  paydown: number;
  /** Absent at baseline, present at latest — labeled exactly this. */
  appearedSinceBaseline: number;
}

/** Paydown credit: the authors whose commits touched resolved files. */
export interface PaydownCredit {
  author: string;
  resolved: number;
}

/** The debt report payload. */
export interface DebtReport {
  calibration: string;
  /** When each reviewer's stock was last evidenced — the staleness facts. */
  evidence: { reviewerName: string; baselineAt: string; currentAt: string }[];
  rows: DebtRow[];
  /** Current-stock concentration by directory, worst first. */
  concentration: { directory: string; violations: number }[];
  credits: PaydownCredit[];
  /** Why credit may be missing. */
  creditNote: string | null;
  /** Stock movement across the last two baselines, boundary named. */
  rebaseline: { boundaryLabel: string; before: number; after: number } | null;
}
