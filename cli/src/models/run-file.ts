import type { LedgerCritiqueRecord, LedgerRecord, LedgerRunRecord } from "@/types.js";

/**
 * One run file's format (05): the run record on line one, one critique
 * record per line beneath, written whole and never touched again.
 *
 * Parsing is tolerant the way evidence reading must be: a file whose
 * first line is not a run record is not a run file (null), and a
 * malformed critique line loses one record, never the file. The store
 * owns the IO; this model owns the bytes.
 */
export class RunFile {
  /** The run record: line one. */
  readonly run: LedgerRunRecord;

  private readonly critiqueLines: string[];

  private constructor(run: LedgerRunRecord, critiqueLines: string[]) {
    this.run = run;
    this.critiqueLines = critiqueLines;
  }

  /** Parses a run file's content, or null when it is not one. */
  static fromContent(content: string): RunFile | null {
    const [firstLine, ...rest] = content.split("\n");

    try {
      const run = JSON.parse(firstLine) as LedgerRunRecord;

      if (run.kind !== "run") return null;

      return new RunFile(run, rest);
    } catch {
      return null;
    }
  }

  /** One run's records as its file content — the write-once shape. */
  static serialize(records: LedgerRecord[]): string {
    return records.map((record) => JSON.stringify(record)).join("\n") + "\n";
  }

  /** The critique records beneath the run; malformed lines skipped. */
  critiques(): LedgerCritiqueRecord[] {
    const critiques: LedgerCritiqueRecord[] = [];

    for (const line of this.critiqueLines) {
      if (!line.includes('"critique"')) continue;

      try {
        const record = JSON.parse(line) as LedgerCritiqueRecord;

        if (record.kind === "critique") critiques.push(record);
      } catch {
        // One malformed line loses one record, never the file.
      }
    }

    return critiques;
  }
}
