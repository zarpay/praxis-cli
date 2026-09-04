// The calibration layer's shapes (06): frozen, human-adjudicated cases
// and the ledger records `calibrate run` writes. Scores are stored as
// counts — rates derive read-side through the metrics rules (07), so
// floors and denominators apply at render, never at write.

/** The adjudicated verdict a case expects. */
export type CalibrationVerdict = "pass" | "warn" | "fail";

/**
 * A case's `expected.json` (06). `spec_path` is a flagged addition
 * (2026-09-05): staleness asks whether the *live* counterpart of the
 * frozen spec has changed, which needs its project-relative path.
 */
export interface CalibrationExpectation {
  verdict: CalibrationVerdict;
  expected_violations: { axiom_id: string; must_flag: true }[];
  forbidden_violations: { axiom_id: string; must_not_flag: true }[];
  /** Project-relative path of the live spec the case froze. */
  spec_path: string;
  adjudicated_by: string;
  adjudicated_on: string;
  rationale: string;
}

/** One axiom's outcome counts across the case set, per repeat summed. */
export interface CalibrationAxiomScore {
  axiom_id: string;
  /** Case × repeat opportunities whose expectation names the axiom. */
  cases: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  /** Flag-count variance across repeats; null when repeats = 1. */
  variance: number | null;
}

/**
 * One `calibrate run` per reviewer, as stored in the ledger's
 * calibration partition (`.praxis/ledger/calibration/`, decided
 * 2026-09-04): the instrument's measured error, with full provenance.
 */
export interface LedgerCalibrationRecord {
  kind: "calibration";
  calibration_id: string;
  timestamp: string;
  commit_sha: string | null;
  branch: string | null;
  reviewer_name: string;
  reviewer_model: string;
  reviewer_hash: string;
  case_count: number;
  /** Hash over the sorted case identities (id + input hash + spec hash) — the staleness input beyond the reviewer hash. */
  case_set_hash: string;
  /**
   * Hash over the active checklists of every case's live spec at run
   * time (added 2026-09-05, found live): ratifying or versioning an
   * axiom grounded in a case's spec changes what the reviewer is asked
   * on that case without touching the case set or the reviewer hash —
   * the third way the instrument changes under you.
   */
  checklist_hash: string;
  repeats: number;
  /** Verdict-level agreement: cases × repeats where the reviewer's verdict matched the adjudicated one. */
  verdict_matches: number;
  /** Case × repeat runs no verdict could be produced for — mismatches, never silently dropped. */
  unverified_count: number;
  /** Total forbidden flags fired across cases × repeats. */
  false_positive_count: number;
  axiom_scores: CalibrationAxiomScore[];
  /** Axioms whose scores moved beyond the drift threshold vs the previous record; empty on a first record. */
  drift_flagged: string[];
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cost_usd: number | null;
}

/** One case × repeat outcome — the service streams it, the progress view renders it. */
export interface CalibrationCaseOutcome {
  caseId: string;
  repeat: number;
  expected: CalibrationVerdict;
  /** Null when the review itself failed (unverified). */
  actual: CalibrationVerdict | null;
  matched: boolean;
}

/** One reviewer's interpretability state (06 gating). */
export type ReviewerCalibrationState = "calibrated" | "stale" | "absent";

/** One reviewer's calibration status, render-ready (06-g). */
export interface ReviewerCalibrationStatus {
  reviewer: string;
  state: ReviewerCalibrationState;
  /** Why stale / when calibrated — one line a view can print as-is. */
  detail: string;
  /** Timestamp of the latest record, when one exists. */
  lastCalibratedAt: string | null;
}
