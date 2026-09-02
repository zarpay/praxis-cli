import type { LedgerRunRecord, ListLedgerRunsInput } from "@/types.js";

import { exists, listFilesRecursive, readText } from "@/helpers/files-helper.js";
import { joinPath } from "@/helpers/paths-helper.js";

/**
 * Every run record in a project's ledger.
 *
 * A run file's first line is its run record; the critique records
 * beneath it are never parsed here, so listing stays cheap however
 * many critiques a run produced. Files that cannot be parsed are
 * skipped: a ledger that cannot be read must not cost the run that
 * wanted to consult it.
 */
export default function listLedgerRunsService({ root }: ListLedgerRunsInput): LedgerRunRecord[] {
  const runsDir = joinPath(root, ".praxis", "ledger", "runs");

  if (!exists(runsDir)) return [];

  const records: LedgerRunRecord[] = [];

  for (const file of listFilesRecursive(runsDir)) {
    if (!file.endsWith(".jsonl")) continue;

    const record = parseRunRecord(joinPath(runsDir, file));

    if (record) records.push(record);
  }

  return records;
}

/** The file's first line as a run record, or null when it is not one. */
function parseRunRecord(path: string): LedgerRunRecord | null {
  try {
    const firstLine = readText(path).split("\n", 1)[0];
    const record = JSON.parse(firstLine) as LedgerRunRecord;

    return record.kind === "run" ? record : null;
  } catch {
    return null;
  }
}
