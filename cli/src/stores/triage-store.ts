import type { PraxisConfig } from "@/models/praxis-config.js";
import type { CritiqueDecision, TriageRecord, WriteLedgerRunResult } from "@/types.js";

import { exists, listFilesRecursive, readText, writeText } from "@/helpers/files-helper.js";
import { sortableId } from "@/helpers/id-helper.js";
import { joinPath } from "@/helpers/paths-helper.js";
import { TriageSessionFile } from "@/models/triage-session-file.js";

/**
 * The ledger's triage partition: `.praxis/ledger/triage/`, one
 * write-once file per session.
 *
 * Same integrity contract as runs: reads never raise, writes always do
 * — an assignment that silently vanished would resurface its critiques
 * as pending, and re-deciding decided questions is how taxonomies
 * drift. The file format is `TriageSessionFile`; this store owns the
 * layout and the IO.
 */
export class TriageStore {
  private readonly triageDir: string;

  constructor(cfg: PraxisConfig) {
    this.triageDir = joinPath(cfg.root, ".praxis", "ledger", "triage");
  }

  /** Every triage decision on record, across all session files. */
  records(): TriageRecord[] {
    if (!exists(this.triageDir)) return [];

    return listFilesRecursive(this.triageDir)
      .filter((file) => file.endsWith(".jsonl"))
      .map((file) => TriageSessionFile.fromContent(readText(joinPath(this.triageDir, file))))
      .flatMap((file) => file.records());
  }

  /**
   * Every critique's standing decision, joined from the records in
   * append order — the one place a critique's triage state is read, so
   * every reader (queues, labels, listings, reports) agrees.
   *
   * The join's rules: a dismissal stands until a reinstatement lifts it,
   * whatever assignments surround it — a dismissed critique is not
   * evidence and is never labeled; among assignments the newest wins;
   * an assignment to a proposal that was later rejected is void, so its
   * critique falls back to its unmatched verdict and the curate queue.
   */
  decisions(): Map<string, CritiqueDecision> {
    const records = this.records();
    const rejectedAxioms = new Set(
      records.filter((record) => record.kind === "rejection").map((record) => record.axiom_id),
    );
    const decisions = new Map<string, CritiqueDecision>();

    for (const record of records) {
      if (!("critique_id" in record)) continue;

      const decision = decisions.get(record.critique_id) ?? emptyDecision();
      decisions.set(record.critique_id, applyRecord(decision, record, rejectedAxioms));
    }

    return decisions;
  }

  /**
   * Lands one session's decisions as its own file.
   *
   * @throws on write failure
   */
  writeSession(records: TriageRecord[]): WriteLedgerRunResult {
    const sessionId = sortableId();
    const path = joinPath(this.triageDir, `${sessionId}.jsonl`);

    writeText(path, TriageSessionFile.serialize(records));

    return { runId: sessionId, path };
  }
}

/** A critique no record has touched yet. */
function emptyDecision(): CritiqueDecision {
  return { dismissed: false, assignment: null, unmatched: null };
}

/** One record folded into a critique's standing decision. */
function applyRecord(
  decision: CritiqueDecision,
  record: Exclude<TriageRecord, { kind: "rejection" | "deprecation" }>,
  rejectedAxioms: Set<string>,
): CritiqueDecision {
  if (record.kind === "dismissal") return { ...decision, dismissed: true };

  if (record.kind === "reinstatement") return { ...decision, dismissed: false };

  if (record.kind === "unmatched") return { ...decision, unmatched: record };

  if (rejectedAxioms.has(record.axiom_id)) return decision;

  return { ...decision, assignment: record };
}
