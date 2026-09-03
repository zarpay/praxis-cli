import type { ListTriageStateInput, TriageState } from "@/types.js";

import { RunStore } from "@/stores/run-store.js";
import { TriageStore } from "@/stores/triage-store.js";

/**
 * The triage queue, derived — never stored (04).
 *
 * A cross-store derivation, which is what makes it a service: pending =
 * open-channel critiques (null `axiom_id`, from the run store) that no
 * assignment or dismissal record (from the triage store) covers yet.
 * Checklist-born critiques were never pending: they arrived assigned.
 * The counters alongside are the residual signal's raw material.
 */
export default function deriveTriageState({ root }: ListTriageStateInput): TriageState {
  const records = new TriageStore({ projectRoot: root }).records();
  const settled = new Set(
    records
      .filter((record) => record.kind === "assignment" || record.kind === "dismissal")
      .map((record) => record.critique_id),
  );

  const pending = new RunStore({ projectRoot: root })
    .critiques()
    .filter((critique) => critique.axiom_id === null)
    .filter((critique) => !settled.has(critique.id))
    .map((critique) => ({
      id: critique.id,
      runId: critique.run_id,
      filePath: critique.file_path,
      specPath: critique.spec_path,
      severity: critique.severity,
      text: critique.text,
      reviewerName: critique.reviewer_name,
    }));

  return {
    pending,
    assignments: records.filter((record) => record.kind === "assignment"),
    dismissed: records.filter((record) => record.kind === "dismissal").length,
    rejectedProposals: records.filter((record) => record.kind === "rejection").length,
  };
}
