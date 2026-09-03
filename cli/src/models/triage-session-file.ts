import type { TriageRecord } from "@/types.js";

/**
 * One triage session file's format (04, 05): one decision record per
 * line — assignments, dismissals, rejections — written whole and never
 * touched again.
 *
 * Parsing is tolerant: a malformed line loses one record, never the
 * queue. The store owns the IO; this model owns the bytes.
 */
export class TriageSessionFile {
  private readonly lines: string[];

  private constructor(lines: string[]) {
    this.lines = lines;
  }

  /** Parses a session file's content. */
  static fromContent(content: string): TriageSessionFile {
    return new TriageSessionFile(content.split("\n"));
  }

  /** One session's records as its file content — the write-once shape. */
  static serialize(records: TriageRecord[]): string {
    return records.map((record) => JSON.stringify(record)).join("\n") + "\n";
  }

  /** The session's decision records; malformed lines skipped. */
  records(): TriageRecord[] {
    const records: TriageRecord[] = [];

    for (const line of this.lines) {
      if (line.trim() === "") continue;

      try {
        records.push(JSON.parse(line) as TriageRecord);
      } catch {
        // One malformed line loses one record, never the queue.
      }
    }

    return records;
  }
}
