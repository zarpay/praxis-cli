// The measurement read-side (07): epochs, populations, rates, and the
// report payloads — every one a stable --json contract (09).

import type { AxiomStatus } from "@/types/axioms.js";
import type { LedgerCritiqueRecord, LedgerRunRecord } from "@/types/ledger.js";
import type { Severity } from "@/types/shared.js";

/** Structured report of project health. */
export interface StatusReport {
  /**
   * Whether the spec-layer compiler is in use (the experts directory
   * exists). Framework health only surfaces when it is (11): eval-only
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
  /** The situational-poll facts an agent reads from one call (09-ae). */
  evalState: {
    pending_triage: number;
    proposals_pending: number;
    /** True until calibration exists (M6). */
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

/** What the orientation screen shows — bare `praxis` (09-h). */
export interface Orientation {
  lastRun: { at: string; reviewerName: string; anchored: boolean } | null;
  pendingTriage: number;
  proposalsPending: number;
  activeAxioms: number;
  calibration: string;
  /** Errors at the latest corpus run, per reviewer. */
  debtLine: { reviewerName: string; errors: number }[] | null;
}

/**
 * One reviewer whose behavioral hash the ledger has never seen — an
 * epoch boundary (02). Named from the most recent prior run so the
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

/** One epoch: a maximal interval of stable reviewer behavior (02). */
export interface Epoch {
  reviewerHash: string;
  reviewerModel: string;
  /** Run ids in this epoch, in timestamp order. */
  runs: LedgerRunRecord[];
  /** The epoch-opening corpus run, when one exists (02: the baseline). */
  baseline: LedgerRunRecord | null;
  /** How this epoch was opened; null for a reviewer's first epoch. */
  openedBy: EpochBoundaryEvent | null;
}

/** A named epoch boundary — first-class in every report (07, rule 6). */
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

/** One rate, floor-aware: rendered only with its denominator (07). */
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

/** How one report invocation is scoped (07's three levels + filters). */
export interface ReportScope {
  /** Glob or path over critique file_paths; null = everything. */
  target: string | null;
  /** ISO date floor on run timestamps; null = all time. */
  since: string | null;
  branch: string | null;
  /** Exact run commit shas; null = any. */
  commits: string[] | null;
  /** Shas that no longer resolve in this clone (12's note renders). */
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
   * run restates no critiques (05), so it never moves this.
   */
  asOf: string | null;
  /** Distinct files violating. */
  files: number;
  /** Violation counts by derived population (01). */
  byPopulation: Record<PopulationQualifier, number>;
  /** Epoch segments, oldest first — never charted across a boundary. */
  segments: { epochLabel: string; violations: number; runs: number }[];
}

/** One axiom × reviewer row of the flow section (01, 12). */
export interface FlowRow {
  axiomId: string;
  statement: string;
  reviewerName: string;
  introduced: number;
  resolved: number;
  inherited: number;
  /**
   * Introduced counts qualified by population — the head commit's date
   * against the axiom's clock; unknown when the sha expired (12).
   */
  introducedByPopulation: Record<PopulationQualifier, number>;
  /**
   * The eval's number (01): post-spec introduced violations over the
   * spec's applicable opportunities across the selected runs.
   */
  introductionRate: RateCell;
}

/**
 * The flow section (01's violation flow): computed over each branch's
 * latest diff run per reviewer, within each reviewer's current epoch,
 * so reruns replace the picture and nothing sums across a boundary.
 */
export interface FlowReport {
  /** Diff runs the section computed over, after latest-per-branch selection. */
  runsConsidered: number;
  rows: FlowRow[];
}

/** The eval report payload — the stable `--json` contract (09). */
export interface EvalReport {
  scope: ReportScope;
  /** The core panel (07's three-level decision). */
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
  /** Open-channel critiques with no assignment yet — the triage queue. */
  pendingTriage: number;
  /** Dismissed + rejected over all critiques, floor-aware (04). */
  residual: RateCell;
  epochs: EpochSeries[];
  /** Violation flow over diff runs; null when the scope holds none (M5). */
  flow: FlowReport | null;
}

/** The single-axiom drill-down payload. */
export interface AxiomReport {
  axiomId: string;
  /** The per-reviewer calibration banner (06-h) — carried on the payload like every other report. */
  calibration: string;
  /** Named when a calibration run flagged this axiom's scores as drifted (06): rates across that boundary are not comparable. */
  driftNote: string | null;
  /**
   * Inter-reviewer agreement over the scoped evidence (06-p), null with
   * fewer than two reviewers: `corroborated` files were flagged by two
   * or more reviewers; `disagreed` files by exactly one — corpus runs
   * review everything, so a lone witness means the others passed it.
   */
  agreement: { corroborated: number; disagreed: number } | null;
  statement: string;
  status: AxiomStatus;
  severity: Severity;
  groundedIn: string | null;
  introduced: string;
  version: number;
  rows: AxiomReportRow[];
  /** Representative critiques, newest first, capped. */
  examples: { id: string; filePath: string; reviewerName: string; text: string }[];
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
  /** In baseline, gone at latest — corpus-level paydown (02). */
  paydown: number;
  /** Absent at baseline, present at latest — labeled exactly this. */
  appearedSinceBaseline: number;
}

/** Paydown credit: the authors whose commits touched resolved files (02). */
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
  /** Stock movement across the last two baselines, boundary named (02). */
  rebaseline: { boundaryLabel: string; before: number; after: number } | null;
}
