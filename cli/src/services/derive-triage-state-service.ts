import type {
  NoInput,
  PendingCritique,
  Service,
  TriageAssignmentRecord,
  TriageUnmatchedRecord,
} from "@/types.js";

import { joinPath } from "@/helpers/paths-helper.js";
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
 * The triage queues, derived — never stored (04).
 *
 * A critique has three states (owner, 2026-09-07), and this derivation
 * is the one place they are decided:
 *
 * 1. **Untriaged** (`pending`) — no assignment, dismissal, or unmatched
 *    record covers it, or its latest unmatched record was judged
 *    against an axiom set that has since changed. `axioms triage`
 *    categorizes these.
 * 2. **Unidentified** (`unidentified`) — the matcher considered it
 *    against the spec's current active axioms and found no squarely
 *    matching one. `axioms curate` works these, and only these: the
 *    question "does this need a NEW axiom" is only well-posed after
 *    triage has said no existing one fits.
 * 3. **Identified** — an assignment record labels it (or a dismissal
 *    settles it); it appears in neither queue.
 *
 * Checklist-born critiques were never pending: they arrived assigned.
 * The counters alongside are the residual signal's raw material.
 */
const deriveTriageStateService: Service<NoInput, TriageState> = (cfg) => {
  const records = new TriageStore(cfg).records();
  const settled = new Set(
    records
      .filter((record) => record.kind === "assignment" || record.kind === "dismissal")
      .map((record) => record.critique_id),
  );

  // Latest unmatched record per critique — file order is append order.
  const unmatched = new Map<string, TriageUnmatchedRecord>();

  for (const record of records) {
    if (record.kind === "unmatched") unmatched.set(record.critique_id, record);
  }

  const axiomStore = new AxiomStore(cfg);
  const activeSetBySpec = new Map<string, string>();

  /** The spec's current active axiom set, as a comparable key. */
  function activeSetOf(specPath: string): string {
    const known = activeSetBySpec.get(specPath);

    if (known !== undefined) return known;

    const axioms = axiomStore.activeFor(joinPath(cfg.root, specPath));
    const key = axioms.map((axiom) => `${axiom.id}@${axiom.version}`).join(",");
    activeSetBySpec.set(specPath, key);

    return key;
  }

  const pending: PendingCritique[] = [];
  const unidentified: PendingCritique[] = [];

  const open = new RunStore(cfg)
    .critiques()
    .filter((critique) => critique.axiom_id === null)
    .filter((critique) => !settled.has(critique.id));

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

    const record = unmatched.get(critique.id);
    const consideredCurrent =
      record !== undefined &&
      [...record.considered].sort().join(",") === activeSetOf(critique.spec_path);

    if (consideredCurrent) {
      unidentified.push(queued);
    } else {
      pending.push(queued);
    }
  }

  return {
    pending,
    unidentified,
    assignments: records.filter((record) => record.kind === "assignment"),
    dismissed: records.filter((record) => record.kind === "dismissal").length,
    rejectedProposals: records.filter((record) => record.kind === "rejection").length,
  };
};

export default deriveTriageStateService;
