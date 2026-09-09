import type { LedgerCritiqueRecord, LedgerRunRecord } from "@/types.js";

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
    scope?: "corpus" | "diff" | "files";
    runId?: string;
    branch?: string | null;
    commitSha?: string | null;
    baseline?: boolean;
    specUnits?: Record<string, number>;
    costUsd?: number | null;
    failCount?: number;
    /** Fresh reviews this run made; 0 marks an all-hit run. Default 1. */
    cacheMisses?: number;
    cacheHits?: number;
    /** Diff facts, marking the run scope "diff" territory (12). */
    diff?: Record<string, unknown>;
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
    cache_misses: fields.cacheMisses ?? 1,
    cache_hits: fields.cacheHits ?? 0,
    ...(fields.diff && { diff: fields.diff }),
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
  /** Set-difference label on diff-run critiques (12). */
  flow?: "introduced" | "inherited" | "resolved" | null;
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
    flow: fields.flow ?? null,
  });
}

/**
 * One full in-memory critique record, for services that take
 * `LedgerCritiqueRecord[]` directly instead of reading run files.
 * Defaults mirror `critiqueLine`'s: an unlabeled "flash" critique.
 */
export function critiqueRecord(
  overrides: Partial<LedgerCritiqueRecord> = {},
): LedgerCritiqueRecord {
  return {
    kind: "critique",
    id: "r1:1",
    run_id: "r1",
    timestamp: "2026-09-02T10:00:00.000Z",
    file_path: "src/a.ts",
    spec_path: "src/README.md",
    target_content_hash: "aaaa1111",
    spec_content_hash: "bbbb2222",
    reviewer_name: "flash",
    reviewer_model: "m",
    reviewer_hash: "aaaa1111",
    severity: "error",
    text: "Critique r1:1",
    mode: "judgment",
    axiom_id: null,
    axiom_version: null,
    assigned_by: null,
    population: "unknown",
    authorship: "unknown",
    authorship_evidence: null,
    agent_involved: null,
    pre_review: null,
    ...overrides,
  };
}

/**
 * One full in-memory run record, for services that take
 * `LedgerRunRecord[]` directly. Defaults are a cold corpus run by
 * "flash" with empty counts.
 */
export function runRecord(overrides: Partial<LedgerRunRecord> = {}): LedgerRunRecord {
  return {
    kind: "run",
    run_id: "r1",
    timestamp: "2026-09-02T10:00:00.000Z",
    commit_sha: null,
    branch: null,
    trigger: "manual",
    scope: "corpus",
    files_evaluated: 0,
    reviewer_name: "flash",
    reviewer_model: "some/model",
    reviewer_hash: "aaaa1111",
    prompt_tokens: null,
    completion_tokens: null,
    cost_usd: null,
    cache_hits: 0,
    cache_misses: 0,
    pass_count: 0,
    warn_count: 0,
    fail_count: 0,
    unverified_count: 0,
    critique_count: 0,
    calibration_status_at_run: "uncalibrated",
    baseline: false,
    ...overrides,
  };
}
