import type { CacheReviewerIdentity, VerdictEntry } from "@/types.js";

import { createHash } from "node:crypto";

/**
 * Current cache format version.
 *
 * 4.0 renamed each entry's `judge` field to `reviewer`. Older files are
 * ignored rather than migrated — a 3.0 entry has no `reviewer` to match
 * against, so reading one would silently miss every time. Discarding
 * them costs one re-review and cannot be got wrong.
 */
export const CACHE_VERSION = "4.0";

/**
 * One target's cache file: every verdict for it, across specs and
 * reviewers.
 *
 * Entries are keyed `<specHash>:<reviewerHash>`, so both dimensions of
 * verdict identity live in the key and a target's complete state is one
 * committed artifact. The reviewer hash in that key is what makes the
 * cache's invalidation behave as the epoch structure (05): a behavioral
 * change misses every old key and writes new ones, rolling the config
 * back re-hits the old keys at zero cost, and keys belonging to no
 * configured reviewer are prunable.
 *
 * A file of any other version reads as empty rather than raising — the
 * format is a cache, so an unreadable one costs a re-review, never a
 * failed run.
 */
export class CacheFile {
  private readonly verdicts: Record<string, VerdictEntry>;

  private constructor(verdicts: Record<string, VerdictEntry>) {
    this.verdicts = verdicts;
  }

  /** An empty file, as a fresh target starts. */
  static empty(): CacheFile {
    return new CacheFile({});
  }

  /**
   * Parses stored JSON, or null when it is not a current-version file.
   *
   * @throws SyntaxError when the text is not JSON at all — the caller
   *   decides whether that warrants discarding the file
   */
  static parse(json: string): CacheFile | null {
    const data = JSON.parse(json) as { version: string; verdicts: Record<string, VerdictEntry> };

    return data.version === CACHE_VERSION ? new CacheFile(data.verdicts) : null;
  }

  /** The entry key for a (spec, reviewer) pair. */
  static keyFor(specPath: string, reviewerHash: string): string {
    return `${this.specHash(specPath)}:${reviewerHash}`;
  }

  /** Recomputes an entry's key from the fields it stored. */
  static keyOf(entry: VerdictEntry): string {
    return CacheFile.keyFor(entry.spec_path, entry.reviewer.hash);
  }

  /**
   * An 8-char hash of the spec's project-relative path.
   *
   * Relative, so a cache file committed on one machine hits on another.
   */
  private static specHash(specPath: string): string {
    return createHash("sha256").update(specPath).digest("hex").slice(0, 8);
  }

  /** The entry at a key, or undefined. */
  entry(key: string): VerdictEntry | undefined {
    return this.verdicts[key];
  }

  /** Every entry belonging to one reviewer, in stored order. */
  entriesFor(reviewer: CacheReviewerIdentity): VerdictEntry[] {
    return Object.values(this.verdicts).filter((entry) => entry.reviewer.hash === reviewer.hash);
  }

  /**
   * Drops every entry the predicate rejects, returning how many fell.
   *
   * This is the epoch structure's other half: a behavioral change writes
   * new keys, and the old ones sit here until something says which
   * reviewers still exist.
   */
  prune(keep: (entry: VerdictEntry) => boolean): number {
    let pruned = 0;

    for (const [key, entry] of Object.entries(this.verdicts)) {
      if (keep(entry)) continue;

      delete this.verdicts[key];
      pruned++;
    }

    return pruned;
  }

  /** Whether nothing is cached here any more. */
  isEmpty(): boolean {
    return Object.keys(this.verdicts).length === 0;
  }

  /** Upserts one entry, leaving every other spec's and reviewer's alone. */
  put(key: string, entry: VerdictEntry): void {
    this.verdicts[key] = entry;
  }

  /**
   * The file as it should be stored.
   *
   * @throws when the entries cannot round-trip as JSON — the caller
   *   verifies before overwriting a good file with a broken one
   */
  toJson(): string {
    const json = JSON.stringify({ version: CACHE_VERSION, verdicts: this.verdicts }, null, 2);

    JSON.parse(json); // integrity check before it reaches disk

    return json;
  }
}
