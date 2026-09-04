import type { PraxisConfig } from "@/models/praxis-config.js";
import type { LedgerCalibrationRecord } from "@/types.js";

import { exists, listFilesRecursive, readJson, writeJson } from "@/helpers/files-helper.js";
import { sortableId } from "@/helpers/id-helper.js";
import { joinPath } from "@/helpers/paths-helper.js";

/**
 * The ledger's calibration partition: `.praxis/ledger/calibration/`,
 * one write-once file per `calibrate run` × reviewer (06; partition
 * decided 2026-09-04 — records are ledger evidence, and one store per
 * partition is the house contract).
 *
 * Reads never raise — a ledger that cannot be fully read must not cost
 * the command that consults it. Writes always raise.
 */
export class CalibrationStore {
  private readonly recordsDir: string;

  constructor(cfg: PraxisConfig) {
    this.recordsDir = joinPath(cfg.root, ".praxis", "ledger", "calibration");
  }

  /** Sortable, filename-safe, collision-safe — see `sortableId`. */
  mintCalibrationId(): string {
    return sortableId();
  }

  /** Every calibration record, read-soft, sorted by id (write order). */
  records(): LedgerCalibrationRecord[] {
    return this.files()
      .map((path) => recordAt(path))
      .filter((record): record is LedgerCalibrationRecord => record !== null)
      .sort((a, b) => a.calibration_id.localeCompare(b.calibration_id));
  }

  /** The newest record for a reviewer identity, null when none exists. */
  latestFor(reviewerHash: string): LedgerCalibrationRecord | null {
    const matching = this.records().filter((record) => record.reviewer_hash === reviewerHash);

    return matching.at(-1) ?? null;
  }

  /**
   * The newest record for a reviewer *name*, across identities — the
   * drift protocol's baseline (06): drift compares the same instrument
   * before and after a behavioral change, which is exactly when the
   * hash differs.
   */
  latestByName(reviewerName: string): LedgerCalibrationRecord | null {
    const matching = this.records().filter((record) => record.reviewer_name === reviewerName);

    return matching.at(-1) ?? null;
  }

  /**
   * Lands one record as its file: written whole, never touched again.
   *
   * @throws on write failure — a silently missing record is a gap in evidence
   */
  writeRecord(record: LedgerCalibrationRecord): { path: string } {
    const path = joinPath(this.recordsDir, `${record.calibration_id}.json`);

    writeJson(path, record);

    return { path };
  }

  /** Absolute paths of every record file in the partition. */
  private files(): string[] {
    if (!exists(this.recordsDir)) return [];

    return listFilesRecursive(this.recordsDir)
      .filter((file) => file.endsWith(".json"))
      .map((file) => joinPath(this.recordsDir, file));
  }
}

/** One record parsed, null when unreadable (read-soft). */
function recordAt(path: string): LedgerCalibrationRecord | null {
  try {
    const record = readJson<LedgerCalibrationRecord>(path);

    return record.kind === "calibration" ? record : null;
  } catch {
    return null;
  }
}
