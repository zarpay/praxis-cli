import type { LedgerCritiqueRecord, ListLedgerRunsInput } from "@/types.js";

import { exists, listFilesRecursive, readText } from "@/helpers/files-helper.js";
import { joinPath } from "@/helpers/paths-helper.js";

/**
 * Every critique record in a project's ledger.
 *
 * The read-side complement of `list-ledger-runs-service`, which stops
 * at each file's first line; this one reads the critique lines beneath.
 * Unparseable lines are skipped — a ledger that cannot be fully read
 * must not cost the command that consults it.
 */
export default function listLedgerCritiquesService({
  root,
}: ListLedgerRunsInput): LedgerCritiqueRecord[] {
  const runsDir = joinPath(root, ".praxis", "ledger", "runs");

  if (!exists(runsDir)) return [];

  const critiques: LedgerCritiqueRecord[] = [];

  for (const file of listFilesRecursive(runsDir)) {
    if (!file.endsWith(".jsonl")) continue;

    for (const line of readText(joinPath(runsDir, file)).split("\n")) {
      const record = parseCritique(line);

      if (record) critiques.push(record);
    }
  }

  return critiques.sort((a, b) => a.id.localeCompare(b.id));
}

/** One line as a critique record, or null when it is anything else. */
function parseCritique(line: string): LedgerCritiqueRecord | null {
  if (!line.includes('"critique"')) return null;

  try {
    const record = JSON.parse(line) as LedgerCritiqueRecord;

    return record.kind === "critique" ? record : null;
  } catch {
    return null;
  }
}
