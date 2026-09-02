import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Seeds one run file into a project's ledger, as a prior run would have
 * left it: the run record on line one, any extra lines beneath it.
 *
 * Only the fields the epoch machinery reads are settable; everything a
 * test does not care about is omitted, since the readers under test
 * never touch it.
 */
export function seedLedgerRun(
  root: string,
  fields: {
    name: string;
    hash: string;
    model?: string;
    timestamp?: string;
    scope?: "corpus" | "files";
    extraLines?: string[];
  },
): void {
  const dir = join(root, ".praxis", "ledger", "runs");
  mkdirSync(dir, { recursive: true });

  const record = {
    kind: "run",
    run_id: randomUUID(),
    timestamp: fields.timestamp ?? "2026-09-01T10:00:00.000Z",
    reviewer_name: fields.name,
    reviewer_model: fields.model ?? "some/model",
    reviewer_hash: fields.hash,
    scope: fields.scope ?? "corpus",
  };

  const lines = [JSON.stringify(record), ...(fields.extraLines ?? [])];

  writeFileSync(join(dir, `${record.run_id}.jsonl`), lines.join("\n") + "\n");
}
