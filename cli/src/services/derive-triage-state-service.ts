import type {
  CritiqueDecision,
  NoInput,
  PendingCritique,
  Service,
  TriageAssignmentRecord,
} from "@/types.js";

import { AxiomStore } from "@/stores/axiom-store.js";
import { RunStore } from "@/stores/run-store.js";
import { TriageStore } from "@/stores/triage-store.js";

/** The derived triage queues and their residual counters. */
interface TriageState {
  /**
   * Untriaged critiques — never considered by the matcher, or considered
   * against an axiom set that has since changed. Triage's queue.
   */
  pending: PendingCritique[];
  /**
   * Critiques the matcher considered against the current axiom set and
   * could not label — the material for new axioms. Curate's queue.
   */
  unidentified: PendingCritique[];
  /** Every assignment on record — ratification reads a proposal's support here. */
  assignments: TriageAssignmentRecord[];
  dismissed: number;
  rejectedProposals: number;
}

/**
 * The triage queues, derived — never stored.
 *
 * A critique has three states, and this derivation
 * is the one place they are decided:
 *
 * 1. **Untriaged** (`pending`) — no assignment, dismissal, or unmatched
 *    record covers it, or its latest unmatched record was judged
 *    against an axiom set that has since changed. `axioms triage`
 *    categorizes these.
 * 2. **Unidentified** (`unidentified`) — the matcher considered it
 *    against the current active axioms (ALL of them — an axiom is an
 *    abstraction over evidence, never a child of one spec) and found no
 *    squarely matching one. `axioms curate` works these, and only
 *    these: the question "does this need a NEW axiom" is only
 *    well-posed after triage has said no existing one fits.
 * 3. **Identified** — an assignment record labels it; it appears in
 *    neither queue.
 *
 * Orthogonal to all three is **validity**: a critique dismissed in
 * `praxis eval review` is not evidence and appears in no queue until
 * reinstated. An assignment to a since-rejected proposal is void, so
 * its critique returns to the queue its unmatched verdict puts it in.
 * The join that decides all of this is `TriageStore.decisions()`.
 * Checklist-born critiques were never pending: they arrived assigned.
 * `dismissed` counts critiques whose dismissal stands — the
 * reviewer-trust signal's raw material.
 */
const deriveTriageStateService: Service<NoInput, TriageState> = (cfg) => {
  const triageStore = new TriageStore(cfg);
  const records = triageStore.records();
  const decisions = triageStore.decisions();

  const active = new AxiomStore(cfg).active();
  const activeSet = active.map((axiom) => `${axiom.id}@${axiom.version}`).join(",");

  const pending: PendingCritique[] = [];
  const unidentified: PendingCritique[] = [];

  const open = new RunStore(cfg)
    .critiques()
    .filter((critique) => critique.axiom_id === null)
    .filter((critique) => !isSettled(decisions.get(critique.id)));

  for (const critique of open) {
    const queued: PendingCritique = {
      id: critique.id,
      runId: critique.run_id,
      filePath: critique.file_path,
      specPath: critique.spec_path,
      severity: critique.severity,
      text: critique.text,
      reviewerName: critique.reviewer_name,
    };

    const unmatched = decisions.get(critique.id)?.unmatched ?? null;
    const consideredCurrent =
      unmatched !== null && [...unmatched.considered].sort().join(",") === activeSet;

    if (consideredCurrent) {
      unidentified.push(queued);
    } else {
      pending.push(queued);
    }
  }

  const dismissed = [...decisions.values()].filter((decision) => decision.dismissed).length;

  return {
    pending,
    unidentified,
    assignments: records.filter((record) => record.kind === "assignment"),
    dismissed,
    rejectedProposals: records.filter((record) => record.kind === "rejection").length,
  };
};

/** Dismissed or labeled: the critique is in no queue. */
function isSettled(decision: CritiqueDecision | undefined): boolean {
  if (decision === undefined) return false;

  return decision.dismissed || decision.assignment !== null;
}

export default deriveTriageStateService;
