import type {
  LedgerCritiqueRecord,
  LedgerRecord,
  LedgerRunRecord,
  TriageRecord,
  TriageState,
  WriteLedgerRunResult,
} from "@/types.js";

import { randomBytes } from "node:crypto";

import { exists, listFilesRecursive, readText, writeText } from "@/helpers/files-helper.js";
import { joinPath } from "@/helpers/paths-helper.js";

/**
 * The project's ledger: the append-only store of evidence (05).
 *
 * One handle owns the layout (`.praxis/ledger/runs/`, `ledger/triage/`),
 * the id minting, the record-parsing conventions, and the append-once
 * writes — the store's lifecycle events are methods here, not services
 * (a service that is one lifecycle event of one store is falsely
 * externalized). What stays outside: record *assembly* (git facts,
 * verdict counts, usage sums) and every policy about what a failure
 * means to a run — those are the write services' business.
 *
 * Reads never raise: a ledger that cannot be fully read must not cost
 * the command that consults it. Writes always raise: an eval store with
 * optional gaps is not an eval store.
 */
export class Ledger {
  private readonly runsDir: string;
  private readonly triageDir: string;

  constructor({ projectRoot }: { projectRoot: string }) {
    this.runsDir = joinPath(projectRoot, ".praxis", "ledger", "runs");
    this.triageDir = joinPath(projectRoot, ".praxis", "ledger", "triage");
  }

  /** Sortable, filename-safe, collision-safe: the UTC instant plus 32 random bits. */
  mintRunId(): string {
    const instant = new Date().toISOString().replace(/[-:.]/g, "");

    return `${instant}-${randomBytes(4).toString("hex")}`;
  }

  /**
   * Every run record: each run file's first line. The critique lines
   * beneath are never parsed here, so listing stays cheap however many
   * critiques a run produced. Unparseable files are skipped.
   */
  runs(): LedgerRunRecord[] {
    const records: LedgerRunRecord[] = [];

    for (const path of this.runFiles()) {
      const record = parseRunRecord(path);

      if (record) records.push(record);
    }

    return records;
  }

  /**
   * Every critique record, across all run files, sorted by id.
   * Unparseable lines are skipped, never fatal.
   */
  critiques(): LedgerCritiqueRecord[] {
    const critiques: LedgerCritiqueRecord[] = [];

    for (const path of this.runFiles()) {
      for (const line of readText(path).split("\n")) {
        const record = parseCritique(line);

        if (record) critiques.push(record);
      }
    }

    return critiques.sort((a, b) => a.id.localeCompare(b.id));
  }

  /** Every triage decision on record, across all session files. */
  triageRecords(): TriageRecord[] {
    if (!exists(this.triageDir)) return [];

    const records: TriageRecord[] = [];

    for (const file of listFilesRecursive(this.triageDir)) {
      if (!file.endsWith(".jsonl")) continue;

      for (const line of readText(joinPath(this.triageDir, file)).split("\n")) {
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

  /**
   * The triage queue, derived — never stored (04).
   *
   * Pending = open-channel critiques (null `axiom_id`) that no
   * assignment or dismissal record covers yet. Checklist-born critiques
   * were never pending: they arrived assigned. The counters alongside
   * are the residual signal's raw material.
   */
  triageState(): TriageState {
    const records = this.triageRecords();
    const settled = new Set(
      records
        .filter((record) => record.kind === "assignment" || record.kind === "dismissal")
        .map((record) => record.critique_id),
    );

    const pending = this.critiques()
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

  /**
   * Lands one run's records as its run file: written whole, never
   * touched again — append-only means record immutability, and
   * one-file-per-run keeps concurrent runs and git merges conflict-free.
   *
   * @throws on write failure — a silently missing run is a gap in evidence
   */
  writeRun(runId: string, records: LedgerRecord[]): WriteLedgerRunResult {
    const path = joinPath(this.runsDir, `${runId}.jsonl`);

    writeText(path, records.map((record) => JSON.stringify(record)).join("\n") + "\n");

    return { runId, path };
  }

  /**
   * Lands one triage session's decisions as its session file — same
   * integrity contract as run files.
   *
   * @throws on write failure — a vanished assignment would resurface its
   *   critiques as pending, and re-deciding decided questions is how
   *   taxonomies drift
   */
  appendTriageSession(records: TriageRecord[]): WriteLedgerRunResult {
    const sessionId = this.mintRunId();
    const path = joinPath(this.triageDir, `${sessionId}.jsonl`);

    writeText(path, records.map((record) => JSON.stringify(record)).join("\n") + "\n");

    return { runId: sessionId, path };
  }

  /** Absolute paths of every run file in the store. */
  private runFiles(): string[] {
    if (!exists(this.runsDir)) return [];

    return listFilesRecursive(this.runsDir)
      .filter((file) => file.endsWith(".jsonl"))
      .map((file) => joinPath(this.runsDir, file));
  }
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
