import type {
  AssistFileRecord,
  CacheFile,
  CacheFileData,
  CacheJudgeIdentity,
  OrphanedCacheFile,
  Verdict,
  VerdictEntry,
} from "@/domains/eval/types.js";

import fg from "fast-glob";
import { createHash } from "node:crypto";

import { PraxisBase } from "@/core/base.js";
import {
  exists,
  fileSize,
  matchesFilename,
  readText,
  removeFile,
  writeText,
} from "@/core/files.js";
import { baseName, joinPath, parentDir } from "@/core/paths.js";
import { DEFAULT_SPEC_FILE_PATTERN } from "@/domains/workspace/models/praxis-config.js";

/** Current cache format version. Pre-3.0 files are ignored (v2 is a breaking release). */
const CACHE_VERSION = "3.0";

/**
 * Manages the file-based verdict cache.
 *
 * One JSON file per target under `.praxis/cache/validation/`, mirroring
 * the target's project path. Each file holds every verdict for that
 * target — all specs, all judges — keyed by `<specHash>:<judgeHash>`,
 * so a target's complete judgment state lives in one committed artifact
 * and cross-judge comparison is a single read.
 *
 * The judge hash in the key is what makes the cache's invalidation
 * behavior the epoch structure (05): a behavioral judge change misses
 * every old key and writes new ones; rolling the config back re-hits
 * the old keys at zero cost; keys belonging to no configured judge are
 * prunable. A CacheManager is bound to one judge identity; readers
 * construct one per configured judge.
 */
export class CacheManager extends PraxisBase {
  /** Directory all cache files live under (default: {root}/.praxis/cache/validation). */
  readonly cacheRoot: string;
  private readonly projectRoot: string | null;
  private readonly judge: CacheJudgeIdentity | null;

  constructor({
    cacheRoot,
    projectRoot,
    judge,
  }: {
    /** Base cache directory; defaults to {projectRoot}/.praxis/cache/validation. */
    cacheRoot?: string;
    /** Project root for relative cache paths and default locations. */
    projectRoot?: string;
    /** The judge whose verdicts this manager reads and writes. */
    judge?: CacheJudgeIdentity;
  } = {}) {
    super();
    this.projectRoot = projectRoot ?? null;
    this.cacheRoot = cacheRoot ?? this.defaultCacheRoot();
    this.judge = judge ?? null;
  }

  /**
   * Computes the filesystem path for a target's cache file.
   *
   * When a projectRoot is set, strips it from absolute target paths
   * to produce a root-relative cache path. Otherwise uses the path as-is.
   *
   * @param targetPath - Path to the judged target
   */
  cachePathFor(targetPath: string): string {
    const relativePath = this.relativeToRoot(targetPath);
    const dirPath = parentDir(relativePath);
    const base = baseName(relativePath, ".md");

    return joinPath(this.cacheRoot, dirPath, `${base}.json`);
  }

  /**
   * Writes a verdict to the cache.
   *
   * Reads the target's existing cache file (if any) and upserts this
   * judge's entry for the spec; other specs' and judges' entries are
   * preserved. Verifies JSON integrity before writing. Silently fails
   * on I/O errors.
   */
  write({
    targetPath,
    contentHash,
    result,
    metadata,
  }: {
    targetPath: string;
    contentHash: string;
    result: Verdict;
    metadata: {
      specPath: string;
      /** Resolved exemplar provenance, recorded when the spec blesses any. */
      exemplarFiles?: AssistFileRecord[];
      /** Resolved context provenance, recorded when the spec declares any. */
      contextFiles?: AssistFileRecord[];
    };
  }): void {
    const cachePath = this.cachePathFor(targetPath);
    const fileData = this.loadFile(cachePath);

    fileData.verdicts[this.verdictKey(metadata.specPath)] = this.buildEntry(
      contentHash,
      result,
      metadata,
    );

    try {
      const json = JSON.stringify(fileData, null, 2);
      JSON.parse(json); // verify integrity before writing
      writeText(cachePath, json);
    } catch (err) {
      this.removeQuietly(cachePath);
      this.debug(`Failed to write cache file (${(err as Error).message})`);
    }
  }

  /**
   * Reads this judge's cached verdict for a (target, spec) pair.
   *
   * Returns null if the cache file doesn't exist, the entry is absent,
   * or the content hash doesn't match.
   */
  read({
    targetPath,
    contentHash,
    specPath,
  }: {
    targetPath: string;
    contentHash: string;
    specPath: string;
  }): Verdict | null {
    const cachePath = this.cachePathFor(targetPath);
    // The judging path discards a corrupt file so the next write starts
    // clean; the report-only readers below deliberately leave it alone.
    const fileData = this.parseFile(cachePath, (err) => {
      this.removeQuietly(cachePath);
      this.debug(`Removed corrupt cache file ${cachePath} (${err.message})`);
    });

    if (!fileData) return null;

    const entry = fileData.verdicts[this.verdictKey(specPath)];

    if (entry?.content_hash !== contentHash) return null;

    return entry.result;
  }

  /**
   * Reads one of this judge's cached verdicts without hash validation.
   *
   * When `specPath` is provided, returns the entry for that spec.
   * When omitted, returns this judge's first entry (useful for
   * single-spec targets). Returns null if no matching entry exists.
   * Does not delete corrupt files (purely read-only).
   */
  readRaw({
    targetPath,
    specPath,
  }: {
    targetPath: string;
    specPath?: string;
  }): CacheFileData | null {
    const entries = this.readEntries(targetPath);

    const entry = specPath
      ? entries.find((candidate) => this.verdictKeyOf(candidate) === this.verdictKey(specPath))
      : entries[0];

    if (!entry) return null;

    return this.entryToCacheFileData(targetPath, entry);
  }

  /**
   * Reads all of this judge's cached verdicts for a target across specs.
   *
   * Returns an empty array if no cache file exists or it is unreadable.
   */
  readAllRaw({ targetPath }: { targetPath: string }): CacheFileData[] {
    return this.readEntries(targetPath).map((entry) =>
      this.entryToCacheFileData(targetPath, entry),
    );
  }

  /**
   * Returns statistics about the current cache.
   *
   * Not yet surfaced by any CLI command; kept for cache tooling.
   */
  stats(): { totalFiles: number; totalSize: number; byType: Record<string, number> } {
    const cacheFiles = fg.sync("**/*.json", { cwd: this.cacheRoot, absolute: true });

    let totalSize = 0;
    const byType: Record<string, number> = {};

    for (const file of cacheFiles) {
      try {
        totalSize += fileSize(file);
      } catch {
        /* skip unreadable files */
      }

      const type = this.typeOf(file);
      byType[type] = (byType[type] ?? 0) + 1;
    }

    return { totalFiles: cacheFiles.length, totalSize, byType };
  }

  /**
   * Finds cache files that no longer correspond to valid documents.
   *
   * A cache file is orphaned if the source document was deleted.
   * Stale hashes are no longer orphans — they get overwritten in-place.
   *
   * Known limitation: only deleted documents are detected. Entries whose
   * spec or judge was removed (while the target still exists) are not
   * reported. Not yet surfaced by any CLI command; kept for cache tooling.
   *
   * @param root - Project root directory
   * @param sources - Array of source directory paths relative to root
   */
  orphanedCacheFiles(
    root: string,
    sources: string[],
    specFilePattern: string = DEFAULT_SPEC_FILE_PATTERN,
    ignore: string[] = [],
  ): OrphanedCacheFile[] {
    const validDocuments = this.buildDocumentMap(root, sources, specFilePattern, ignore);
    const orphans: OrphanedCacheFile[] = [];
    const cacheFiles = fg.sync("**/*.json", { cwd: this.cacheRoot, absolute: true });

    for (const cacheFile of cacheFiles) {
      const docKey = this.cacheRelative(cacheFile).replace(/\.json$/, "");

      if (!validDocuments.has(docKey)) {
        orphans.push({
          file: cacheFile,
          reason: "document_missing",
          docName: baseName(cacheFile, ".json"),
          type: this.typeOf(cacheFile),
        });
      }
    }

    return orphans;
  }

  /** A cache file's path relative to the cache root. */
  private cacheRelative(cacheFile: string): string {
    return cacheFile.replace(`${this.cacheRoot}/`, "");
  }

  /** A cache file's type: the first directory segment under the cache root. */
  private typeOf(cacheFile: string): string {
    return this.cacheRelative(cacheFile).split("/")[0] ?? "unknown";
  }

  /**
   * The default cache root: `.praxis/cache/validation` under the
   * project. Eval owns where its own verdicts live.
   */
  private defaultCacheRoot(): string {
    return joinPath(this.projectRoot ?? process.cwd(), ".praxis", "cache", "validation");
  }

  /** Reads a target's v3.0 entries belonging to this manager's judge. */
  private readEntries(targetPath: string): VerdictEntry[] {
    const fileData = this.parseFile(this.cachePathFor(targetPath));

    if (!fileData) return [];

    const judgeHash = this.judgeIdentity().hash;

    return Object.values(fileData.verdicts).filter((entry) => entry.judge.hash === judgeHash);
  }

  /**
   * Loads a target's cache file as a v3.0 structure.
   *
   * Files that are absent, corrupt, or in a pre-3.0 format start fresh
   * — v2 is a breaking release and old verdicts are simply re-judged.
   */
  private loadFile(cachePath: string): CacheFile {
    return this.parseFile(cachePath) ?? { version: CACHE_VERSION, verdicts: {} };
  }

  /**
   * Parses a target's cache file, or null when there is nothing usable.
   *
   * Absent, pre-3.0, and corrupt files all yield null: v2 is a breaking
   * release, and an unreadable verdict is simply re-judged. `onCorrupt`
   * fires only for a file that exists and fails to parse — the one case
   * a caller may want to act on — so the decision to delete stays with
   * the caller rather than being buried here.
   */
  private parseFile(cachePath: string, onCorrupt?: (err: Error) => void): CacheFile | null {
    if (!exists(cachePath)) return null;

    try {
      const fileData = JSON.parse(readText(cachePath)) as CacheFile;

      return fileData.version === CACHE_VERSION ? fileData : null;
    } catch (err) {
      onCorrupt?.(err as Error);
      return null;
    }
  }

  /** Builds the entry this manager's judge stores for one judgment. */
  private buildEntry(
    contentHash: string,
    result: Verdict,
    metadata: {
      specPath: string;
      exemplarFiles?: AssistFileRecord[];
      contextFiles?: AssistFileRecord[];
    },
  ): VerdictEntry {
    const entry: VerdictEntry = {
      judge: this.judgeIdentity(),
      spec_path: this.relativeToRoot(metadata.specPath),
      cached_at: new Date().toISOString(),
      content_hash: contentHash,
      result: {
        ...result,
        reason: sanitizeText(result.reason),
        issues: result.issues.map(sanitizeText),
      },
    };

    if (metadata.exemplarFiles?.length) entry.exemplar_files = metadata.exemplarFiles;

    if (metadata.contextFiles?.length) entry.context_files = metadata.contextFiles;

    return entry;
  }

  /** Deletes a file, ignoring failures: cleanup must never mask the real error. */
  private removeQuietly(cachePath: string): void {
    try {
      if (exists(cachePath)) removeFile(cachePath);
    } catch {
      /* ignore cleanup failures */
    }
  }

  /**
   * Reports a cache problem, but only under DEBUG.
   *
   * The cache degrades silently by design — a miss costs an API call,
   * never a failed run — so its diagnostics are opt-in.
   */
  private debug(message: string): void {
    if (process.env["DEBUG"]) {
      this.logger.warn(message);
    }
  }

  /** Constructs the flattened per-verdict view for report consumers. */
  private entryToCacheFileData(targetPath: string, entry: VerdictEntry): CacheFileData {
    return {
      version: CACHE_VERSION,
      cached_at: entry.cached_at,
      content_hash: entry.content_hash,
      document: {
        path: targetPath,
        spec_path: entry.spec_path,
      },
      result: entry.result,
    };
  }

  /**
   * The entry key for a (spec, judge) pair: `<specHash>:<judgeHash>`.
   *
   * Both dimensions of verdict identity live in the key, so one file
   * holds a target's complete judgment state.
   */
  private verdictKey(specPath: string): string {
    return `${this.specHash(specPath)}:${this.judgeIdentity().hash}`;
  }

  /** Recomputes an entry's key from its stored fields. */
  private verdictKeyOf(entry: VerdictEntry): string {
    return `${this.specHash(entry.spec_path)}:${entry.judge.hash}`;
  }

  /** This manager's judge identity, with a placeholder when unbound (tests). */
  private judgeIdentity(): CacheJudgeIdentity {
    return this.judge ?? { name: "unbound", model: "unbound", hash: "00000000" };
  }

  /**
   * Computes an 8-char SHA256 hash of the spec's project-relative path.
   *
   * Normalizing to a project-relative path before hashing ensures
   * stability across machines.
   */
  private specHash(specPath: string): string {
    return createHash("sha256").update(this.relativeToRoot(specPath)).digest("hex").slice(0, 8);
  }

  /**
   * Strips the project root prefix from a path.
   *
   * Returns the path unchanged when there is no root or the path lies
   * outside it. Both the cache file's location and the hashed spec path
   * go through here, so a target and its spec are normalized the same
   * way and cache keys stay stable across machines.
   */
  private relativeToRoot(path: string): string {
    if (!this.projectRoot) return path;

    const root = this.projectRoot.endsWith("/") ? this.projectRoot : `${this.projectRoot}/`;

    return path.startsWith(root) ? path.slice(root.length) : path;
  }

  /**
   * Builds a set of valid document keys for orphan detection.
   *
   * Scans source directories for .md files and builds keys matching
   * the cache path structure (source-relative paths without extension).
   */
  private buildDocumentMap(
    root: string,
    sources: string[],
    specFilePattern: string,
    ignore: string[] = [],
  ): Set<string> {
    const documents = new Set<string>();
    const absoluteIgnore = ignore.map((p) => joinPath(root, p));

    for (const source of sources) {
      const sourceDir = joinPath(root, source);

      if (!exists(sourceDir)) continue;

      const docFiles = fg.sync("**/*.md", {
        cwd: sourceDir,
        absolute: false,
        ignore: absoluteIgnore,
      });

      for (const relFile of docFiles) {
        const name = baseName(relFile);

        if (matchesFilename(name, specFilePattern) || baseName(relFile, ".md").startsWith("_")) {
          continue;
        }

        const key = joinPath(source, relFile).replace(/\.md$/, "");
        documents.add(key);
      }
    }

    return documents;
  }
}

/**
 * Strips control characters and double quotes from a string to prevent
 * malformed JSON in cache files. Preserves newlines, carriage returns, and tabs.
 */
function sanitizeText(text: string): string {
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").replace(/"/g, "'");
}
