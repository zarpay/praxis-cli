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
    runId?: string;
    branch?: string | null;
    commitSha?: string | null;
    baseline?: boolean;
    specUnits?: Record<string, number>;
    costUsd?: number | null;
    failCount?: number;
    extraLines?: string[];
  },
): void {
  const dir = join(root, ".praxis", "ledger", "runs");
  mkdirSync(dir, { recursive: true });

  const record = {
    kind: "run",
    run_id: fields.runId ?? randomUUID(),
    timestamp: fields.timestamp ?? "2026-09-01T10:00:00.000Z",
    reviewer_name: fields.name,
    reviewer_model: fields.model ?? "some/model",
    reviewer_hash: fields.hash,
    scope: fields.scope ?? "corpus",
    branch: fields.branch ?? null,
    commit_sha: fields.commitSha ?? null,
    baseline: fields.baseline ?? false,
    cost_usd: fields.costUsd ?? null,
    fail_count: fields.failCount ?? 0,
    ...(fields.specUnits && { spec_units: fields.specUnits }),
  };

  const lines = [JSON.stringify(record), ...(fields.extraLines ?? [])];

  writeFileSync(join(dir, `${String(record.run_id)}.jsonl`), lines.join("\n") + "\n");
}

/**
 * One critique record as a run-file line. Defaults are an open-channel
 * critique from "flash" on `src/a.ts`; matched-channel tests pass
 * `axiomId`/`axiomVersion`.
 */
export function critiqueLine(fields: {
  runId: string;
  seq?: number;
  filePath?: string;
  specPath?: string;
  severity?: "error" | "warning";
  text?: string;
  reviewer?: string;
  axiomId?: string | null;
  axiomVersion?: number | null;
  timestamp?: string;
}): string {
  const id = `${fields.runId}:${fields.seq ?? 1}`;

  return JSON.stringify({
    kind: "critique",
    id,
    run_id: fields.runId,
    timestamp: fields.timestamp ?? "2026-09-02T10:00:00.000Z",
    file_path: fields.filePath ?? "src/a.ts",
    spec_path: fields.specPath ?? "src/README.md",
    severity: fields.severity ?? "error",
    text: fields.text ?? `Critique ${id}`,
    reviewer_name: fields.reviewer ?? "flash",
    axiom_id: fields.axiomId ?? null,
    axiom_version: fields.axiomVersion ?? null,
  });
}
