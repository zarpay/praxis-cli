import type {
  AxiomDeprecationRecord,
  CritiqueReinstatementRecord,
  ProposalRejectionRecord,
  TriageAssignmentRecord,
  TriageDismissalRecord,
  TriageUnmatchedRecord,
} from "@/types.js";

/**
 * The triage-record factories — the ledger's decision shapes, built
 * with sensible defaults so a test states only what it is about.
 * These mirror `TriageRecord`'s members one to one; a test that
 * redeclares one of these literals is duplicating a contract every
 * other triage test already depends on.
 */

/** A label: this critique belongs to this axiom. */
export function assignmentRecord(
  overrides: Partial<TriageAssignmentRecord> = {},
): TriageAssignmentRecord {
  return {
    kind: "assignment",
    critique_id: "r1:1",
    axiom_id: "AX-aaaa11",
    axiom_version: 1,
    assigned_by: { decision: "human", suggested_by: "big/model" },
    timestamp: "2026-09-05T10:00:00.000Z",
    ...overrides,
  };
}

/** A validity call: this critique is not evidence until reinstated. */
export function dismissalRecord(
  overrides: Partial<TriageDismissalRecord> = {},
): TriageDismissalRecord {
  return {
    kind: "dismissal",
    critique_id: "r1:1",
    reason: "not grounded in the spec",
    timestamp: "2026-09-05T10:00:00.000Z",
    ...overrides,
  };
}

/** The dismissal lifted: the critique is evidence again. */
export function reinstatementRecord(
  overrides: Partial<CritiqueReinstatementRecord> = {},
): CritiqueReinstatementRecord {
  return {
    kind: "reinstatement",
    critique_id: "r1:1",
    reason: "the dismissal was wrong",
    timestamp: "2026-09-05T10:00:00.000Z",
    ...overrides,
  };
}

/** No active axiom matched, judged against the pinned set. */
export function unmatchedRecord(
  overrides: Partial<TriageUnmatchedRecord> = {},
): TriageUnmatchedRecord {
  return {
    kind: "unmatched",
    critique_id: "r1:1",
    considered: ["AX-aaaa11@1"],
    suggested_by: "big/model",
    timestamp: "2026-09-05T10:00:00.000Z",
    ...overrides,
  };
}

/** A proposal rejected: assignments to it are void from then on. */
export function rejectionRecord(
  overrides: Partial<ProposalRejectionRecord> = {},
): ProposalRejectionRecord {
  return {
    kind: "rejection",
    axiom_id: "AX-aaaa11",
    reason: "twin of an existing axiom",
    timestamp: "2026-09-05T10:00:00.000Z",
    ...overrides,
  };
}

/** An active axiom retired; its records stay readable. */
export function deprecationRecord(
  overrides: Partial<AxiomDeprecationRecord> = {},
): AxiomDeprecationRecord {
  return {
    kind: "deprecation",
    axiom_id: "AX-aaaa11",
    reason: "now a lint rule",
    timestamp: "2026-09-05T10:00:00.000Z",
    ...overrides,
  };
}
