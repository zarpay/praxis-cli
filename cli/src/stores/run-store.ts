import type { PraxisConfig } from "@/models/praxis-config.js";
import type {
  LedgerCritiqueRecord,
  LedgerRecord,
  LedgerRunRecord,
  WriteLedgerRunResult,
} from "@/types.js";

import { exists, listFilesRecursive, readText, writeText } from "@/helpers/files-helper.js";
import { sortableId } from "@/helpers/id-helper.js";
import { joinPath } from "@/helpers/paths-helper.js";
import { RunFile } from "@/models/run-file.js";

/**
 * The ledger's runs partition: `.praxis/ledger/runs/`, one write-once
 * file per (invocation, reviewer) (05).
 *
 * Reads never raise — a ledger that cannot be fully read must not cost
 * the command that consults it. Writes always raise — an eval store
 * with optional gaps is not an eval store. The file format is
 * `RunFile`; this store owns the layout, the id minting, and the IO.
 */
export class RunStore {
  private readonly runsDir: string;

  constructor(config: PraxisConfig) {
    this.runsDir = joinPath(config.root, ".praxis", "ledger", "runs");
  }

  /** Sortable, filename-safe, collision-safe — see `sortableId`. */
  mintRunId(): string {
    return sortableId();
  }

  /**
   * Every run record: each file's first line. Critique lines are never
   * parsed here, so listing stays cheap. Unparseable files are skipped.
   */
  runs(): LedgerRunRecord[] {
    return this.files()
      .map((path) => RunFile.fromContent(readText(path)))
      .filter((file): file is RunFile => file !== null)
      .map((file) => file.run);
  }

  /** Every critique record, across all run files, sorted by id. */
  critiques(): LedgerCritiqueRecord[] {
    const critiques = this.files()
      .map((path) => RunFile.fromContent(readText(path)))
      .filter((file): file is RunFile => file !== null)
      .flatMap((file) => file.critiques());

    return critiques.sort((a, b) => a.id.localeCompare(b.id));
  }

  /**
   * Lands one run's records as its file: written whole, never touched
   * again — append-only means record immutability, and one file per run
   * keeps concurrent runs and git merges conflict-free.
   *
   * @throws on write failure — a silently missing run is a gap in evidence
   */
  writeRun(runId: string, records: LedgerRecord[]): WriteLedgerRunResult {
    const path = joinPath(this.runsDir, `${runId}.jsonl`);

    writeText(path, RunFile.serialize(records));

    return { runId, path };
  }

  /** Absolute paths of every run file in the partition. */
  private files(): string[] {
    if (!exists(this.runsDir)) return [];

    return listFilesRecursive(this.runsDir)
      .filter((file) => file.endsWith(".jsonl"))
      .map((file) => joinPath(this.runsDir, file));
  }
}
