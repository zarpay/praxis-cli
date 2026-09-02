import type { ListTriageStateInput, TriageRecord, TriageState } from "@/types.js";

import { exists, listFilesRecursive, readText } from "@/helpers/files-helper.js";
import { joinPath } from "@/helpers/paths-helper.js";
import listLedgerCritiquesService from "@/services/list-ledger-critiques-service.js";

/**
 * The triage queue, derived — never stored (04).
 *
 * Pending = open-channel critiques (null `axiom_id`) that no assignment
 * or dismissal record covers yet. Checklist-born critiques were never
 * pending: they arrived assigned. The counters alongside are the
 * residual signal's raw material: dismissals and rejected proposals.
 */
export default function listTriageStateService({ root }: ListTriageStateInput): TriageState {
  const records = triageRecords(root);
  const settled = new Set(
    records
      .filter((record) => record.kind === "assignment" || record.kind === "dismissal")
      .map((record) => record.critique_id),
  );

  const pending = listLedgerCritiquesService({ root })
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

/** Every record in the ledger's triage partition. */
function triageRecords(root: string): TriageRecord[] {
  const dir = joinPath(root, ".praxis", "ledger", "triage");

  if (!exists(dir)) return [];

  const records: TriageRecord[] = [];

  for (const file of listFilesRecursive(dir)) {
    if (!file.endsWith(".jsonl")) continue;

    for (const line of readText(joinPath(dir, file)).split("\n")) {
      if (line.trim() === "") continue;

      try {
        records.push(JSON.parse(line) as TriageRecord);
      } catch {
        // A malformed line loses one record, never the queue.
      }
    }
  }

  return records;
}
