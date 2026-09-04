import type { PraxisConfig } from "@/models/praxis-config.js";
import type { TriageRecord, WriteLedgerRunResult } from "@/types.js";

import { exists, listFilesRecursive, readText, writeText } from "@/helpers/files-helper.js";
import { sortableId } from "@/helpers/id-helper.js";
import { joinPath } from "@/helpers/paths-helper.js";
import { TriageSessionFile } from "@/models/triage-session-file.js";

/**
 * The ledger's triage partition: `.praxis/ledger/triage/`, one
 * write-once file per session (04, 05).
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
