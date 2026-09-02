import type { WriteTriageRecordsInput, WriteLedgerRunResult } from "@/types.js";

import { randomBytes } from "node:crypto";

import { writeText } from "@/helpers/files-helper.js";
import { joinPath } from "@/helpers/paths-helper.js";

/**
 * Persists one triage session's decisions to the ledger's triage
 * partition: `.praxis/ledger/triage/<session_id>.jsonl`.
 *
 * Same integrity contract as run files (05): append-only, one file per
 * session written whole and never touched again, so concurrent sessions
 * and git merges stay conflict-free. A write failure throws — an
 * assignment that silently vanished would resurface its critiques as
 * pending, and re-deciding decided questions is how taxonomies drift.
 */
export default function writeTriageRecordsService({
  root,
  records,
}: WriteTriageRecordsInput): WriteLedgerRunResult {
  const instant = new Date().toISOString().replace(/[-:.]/g, "");
  const sessionId = `${instant}-${randomBytes(4).toString("hex")}`;
  const path = joinPath(root, ".praxis", "ledger", "triage", `${sessionId}.jsonl`);

  writeText(path, records.map((record) => JSON.stringify(record)).join("\n") + "\n");

  return { runId: sessionId, path };
}
