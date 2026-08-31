import type { AssistFileRecord } from "@/eval/judgment-input.js";

import fg from "fast-glob";
import { createHash } from "node:crypto";

import { PraxisBase } from "@/core/base.js";
import { DEFAULT_SPEC_FILE_PATTERN } from "@/core/config.js";
import { exists, fileSize, readText, removeFile, writeText } from "@/core/files.js";
import { baseName, joinPath, parentDir, validationCacheDir } from "@/core/paths.js";
import { isSpecFile } from "@/core/spec-pattern.js";

/** Current cache format version. Pre-3.0 files are ignored (v2 is a breaking release). */
const CACHE_VERSION = "3.0";

/** Severity level for validation issues. */
export type Severity = "warning" | "error";

/** Result of a single judgment, as stored in cache. */
export interface Verdict {
  /** Whether the target satisfies its spec. */
  compliant: boolean;
  /** Specific deviations reported by the judge (empty when compliant). */
  issues: string[];
  /** The judge's overall explanation of the verdict. */
  reason: string;
  /** Present only when non-compliant: warning or error. */
  severity?: Severity;
}

/**
 * Cache data shape returned by readRaw() and readAllRaw().
 *
 * A flattened per-verdict view for report consumers.
 */
export interface CacheFileData {
  version: string;
  cached_at: string;
  content_hash: string;
  document: {
    path: string;
    type: string;
    spec_path: string;
  };
  result: Verdict;
}

/**
 * One stored verdict inside a target's cache file, carrying enough
 * judge provenance to be read by a human in the committed JSON.
 */
interface VerdictEntry {
  judge: { name: string; model: string; hash: string };
  spec_path: string;
  target_type: string;
  cached_at: string;
  content_hash: string;
  /** Resolved exemplar files the judge saw, with content hashes (present when the spec blesses any). */
  exemplar_files?: AssistFileRecord[];
  /** Resolved context files the judge saw, with content hashes (present when the spec declares any). */
  context_files?: AssistFileRecord[];
  result: Verdict;
}

/**
 * v3.0 cache file: one file per target, holding every verdict for it —
 * all specs, all judges — keyed by `<specHash>:<judgeHash>`.
 */
interface CacheFile {
  version: "3.0";
  verdicts: Record<string, VerdictEntry>;
}

/** Information about an orphaned (stale) cache file. */
export interface OrphanedCacheFile {
  file: string;
  reason: "document_missing";
  docName: string;
  type: string;
}

/** Identity of the judge whose verdicts a CacheManager reads and writes. */
export interface CacheJudgeIdentity {
  name: string;
  model: string;
  hash: string;
}

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
    let relativePath: string;

    if (this.projectRoot) {
      const absRoot = this.projectRoot.endsWith("/") ? this.projectRoot : this.projectRoot + "/";
      relativePath = targetPath.startsWith(absRoot) ? targetPath.slice(absRoot.length) : targetPath;
    } else {
      relativePath = targetPath;
    }

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
      targetType: string;
      specPath: string;
      /** Resolved exemplar provenance, recorded when the spec blesses any. */
      exemplarFiles?: AssistFileRecord[];
      /** Resolved context provenance, recorded when the spec declares any. */
      contextFiles?: AssistFileRecord[];
    };
  }): void {
    const cachePath = this.cachePathFor(targetPath);

    const entry: VerdictEntry = {
      judge: this.judgeIdentity(),
      spec_path: this.relSpecPath(metadata.specPath),
      target_type: metadata.targetType,
      cached_at: new Date().toISOString(),
      content_hash: contentHash,
      result: {
        ...result,
        reason: sanitizeText(result.reason),
        issues: result.issues.map(sanitizeText),
      },
    };

    if (metadata.exemplarFiles && metadata.exemplarFiles.length > 0) {
      entry.exemplar_files = metadata.exemplarFiles;
    }

    if (metadata.contextFiles && metadata.contextFiles.length > 0) {
      entry.context_files = metadata.contextFiles;
    }

    const fileData = this.loadFile(cachePath);
    fileData.verdicts[this.verdictKey(metadata.specPath)] = entry;

    try {
      const json = JSON.stringify(fileData, null, 2);
      JSON.parse(json); // verify integrity before writing
      writeText(cachePath, json);
    } catch (err) {
      try {
        if (exists(cachePath)) removeFile(cachePath);
      } catch {
        /* ignore cleanup failures */
      }

      if (process.env["DEBUG"]) {
        this.logger.warn(`Failed to write cache file (${(err as Error).message})`);
      }
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

    if (!exists(cachePath)) {
      return null;
    }

    try {
      const fileData = JSON.parse(readText(cachePath)) as { version: string };

      if (fileData.version !== CACHE_VERSION) {
        return null;
      }

      const entry = (fileData as CacheFile).verdicts[this.verdictKey(specPath)];

      if (entry?.content_hash !== contentHash) return null;

      return entry.result;
    } catch (err) {
      try {
        removeFile(cachePath);
      } catch {
        /* ignore */
      }

      if (process.env["DEBUG"]) {
        this.logger.warn(`Removed corrupt cache file ${cachePath} (${(err as Error).message})`);
      }

      return null;
    }
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

      const relativePath = file.replace(`${this.cacheRoot}/`, "");
      const type = relativePath.split("/")[0] ?? "unknown";
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
      const docName = baseName(cacheFile, ".json");
      const relativePath = cacheFile.replace(`${this.cacheRoot}/`, "");
      const type = relativePath.split("/")[0] ?? "unknown";
      const docKey = relativePath.replace(/\.json$/, "");

      if (!validDocuments.has(docKey)) {
        orphans.push({ file: cacheFile, reason: "document_missing", docName, type });
      }
    }

    return orphans;
  }

  /** Derives the default cache root from the project root or cwd. */
  private defaultCacheRoot(): string {
    return validationCacheDir(this.projectRoot ?? process.cwd());
  }

  /** Reads a target's v3.0 entries belonging to this manager's judge. */
  private readEntries(targetPath: string): VerdictEntry[] {
    const cachePath = this.cachePathFor(targetPath);

    if (!exists(cachePath)) {
      return [];
    }

    try {
      const fileData = JSON.parse(readText(cachePath)) as { version: string };

      if (fileData.version !== CACHE_VERSION) {
        return [];
      }

      const judgeHash = this.judgeIdentity().hash;

      return Object.values((fileData as CacheFile).verdicts).filter(
        (entry) => entry.judge.hash === judgeHash,
      );
    } catch {
      return [];
    }
  }

  /**
   * Loads a target's cache file as a v3.0 structure.
   *
   * Files that are absent, corrupt, or in a pre-3.0 format start fresh
   * — v2 is a breaking release and old verdicts are simply re-judged.
   */
  private loadFile(cachePath: string): CacheFile {
    const empty: CacheFile = { version: "3.0", verdicts: {} };

    if (!exists(cachePath)) return empty;

    try {
      const fileData = JSON.parse(readText(cachePath)) as { version: string };

      if (fileData.version === CACHE_VERSION) {
        return fileData as CacheFile;
      }
    } catch {
      /* corrupt file — start fresh */
    }

    return empty;
  }

  /** Constructs the flattened per-verdict view for report consumers. */
  private entryToCacheFileData(targetPath: string, entry: VerdictEntry): CacheFileData {
    return {
      version: CACHE_VERSION,
      cached_at: entry.cached_at,
      content_hash: entry.content_hash,
      document: {
        path: targetPath,
        type: entry.target_type,
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
    return createHash("sha256").update(this.relSpecPath(specPath)).digest("hex").slice(0, 8);
  }

  /** Returns the project-relative form of specPath, or the path unchanged if not resolvable. */
  private relSpecPath(specPath: string): string {
    if (this.projectRoot) {
      const root = this.projectRoot.endsWith("/") ? this.projectRoot : `${this.projectRoot}/`;

      if (specPath.startsWith(root)) {
        return specPath.slice(root.length);
      }
    }

    return specPath;
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

        if (isSpecFile(name, specFilePattern) || baseName(relFile, ".md").startsWith("_")) {
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
 * Computes a cache-key hash from the full judgment input.
 *
 * Returns the first 8 characters of the SHA256 hex digest. Every input
 * the judge saw participates — target, spec, and the serialized assist
 * inputs (exemplars/context, see judgment-input.ts) — so editing any of
 * them invalidates the cached verdict. The assist component defaults to
 * empty, leaving plain specs' hashes unchanged.
 */
export function contentHash(
  targetContent: string,
  specContent: string,
  assistInput = "",
): string {
  return createHash("sha256")
    .update(targetContent + specContent + assistInput)
    .digest("hex")
    .slice(0, 8);
}

/**
 * Strips control characters and double quotes from a string to prevent
 * malformed JSON in cache files. Preserves newlines, carriage returns, and tabs.
 */
function sanitizeText(text: string): string {
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").replace(/"/g, "'");
}
