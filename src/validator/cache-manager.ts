import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import fg from "fast-glob";

import { DEFAULT_SPEC_FILE_PATTERN } from "@/core/config.js";

import { isSpecFile } from "./spec-pattern.js";

/** Current cache format version. */
const CACHE_VERSION = "2.0";

/** Legacy cache format version, supported for transparent migration. */
const CACHE_VERSION_V1 = "1.0";

/** Severity level for validation issues. */
export type Severity = "warning" | "error";

/** Result of a single document validation, as stored in cache. */
export interface CachedValidationResult {
  compliant: boolean;
  issues: string[];
  reason: string;
  severity?: Severity;
}

/**
 * Cache data shape returned by readRaw() and readAllRaw().
 *
 * Uses the same structure as the legacy v1.0 format so callers
 * (e.g. report-formatter) don't need updating.
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
  result: CachedValidationResult;
}

/** Per-spec entry stored in the v2.0 validations map. */
interface SpecCacheEntry {
  spec_path: string;
  document_type: string;
  cached_at: string;
  content_hash: string;
  result: CachedValidationResult;
}

/** v2.0 cache file written to disk — one file per document, many entries per spec. */
interface CacheFileDataV2 {
  version: "2.0";
  validations: Record<string, SpecCacheEntry>;
}

/** v1.0 cache file structure, used only for migration reading. */
interface CacheFileDataV1 {
  version: "1.0";
  cached_at: string;
  content_hash: string;
  document: { path: string; type: string; spec_path: string };
  result: CachedValidationResult;
}

/** Information about an orphaned (stale) cache file. */
export interface OrphanedCacheFile {
  file: string;
  reason: "document_missing";
  docName: string;
  type: string;
}

/**
 * Manages a file-based validation result cache.
 *
 * Cache files are stored as JSON under `.praxis/cache/validation/`
 * organized by document path. Each file contains a `validations` map
 * keyed by an 8-char hash of the spec path, allowing a single document
 * to hold cached results from multiple specs without overwriting.
 *
 * v1.0 cache files are transparently migrated to v2.0 on write.
 */
export class CacheManager {
  readonly cacheRoot: string;
  private readonly projectRoot: string | null;

  constructor(cacheRoot?: string, projectRoot?: string) {
    this.projectRoot = projectRoot ?? null;
    this.cacheRoot = cacheRoot ?? this.defaultCacheRoot();
  }

  /**
   * Computes the filesystem path for a cache entry.
   *
   * When a projectRoot is set, strips it from absolute document paths
   * to produce a root-relative cache path. Otherwise uses the path as-is.
   *
   * @param documentPath - Path to the validated document
   */
  cachePathFor(documentPath: string): string {
    let relativePath: string;

    if (this.projectRoot) {
      const absRoot = this.projectRoot.endsWith("/") ? this.projectRoot : this.projectRoot + "/";
      relativePath = documentPath.startsWith(absRoot)
        ? documentPath.slice(absRoot.length)
        : documentPath;
    } else {
      relativePath = documentPath;
    }

    const dirPath = dirname(relativePath);
    const base = basename(relativePath, ".md");

    return join(this.cacheRoot, dirPath, `${base}.json`);
  }

  /**
   * Writes a validation result to the cache.
   *
   * Reads the existing cache file first (if any) and upserts the result
   * for this spec into the v2.0 validations map. Transparently migrates
   * v1.0 files encountered on disk. Verifies JSON integrity before writing.
   * Silently fails on I/O errors.
   */
  write({
    documentPath,
    contentHash,
    result,
    metadata,
  }: {
    documentPath: string;
    contentHash: string;
    result: CachedValidationResult;
    metadata: { documentType: string; specPath: string };
  }): void {
    const cachePath = this.cachePathFor(documentPath);
    const specKey = this.specHash(metadata.specPath);
    const specRelPath = this.relSpecPath(metadata.specPath);

    const entry: SpecCacheEntry = {
      spec_path: specRelPath,
      document_type: metadata.documentType,
      cached_at: new Date().toISOString(),
      content_hash: contentHash,
      result: {
        ...result,
        reason: sanitizeText(result.reason),
        issues: result.issues.map(sanitizeText),
      },
    };

    const fileData = this.loadOrMigrate(cachePath);
    fileData.validations[specKey] = entry;

    try {
      mkdirSync(dirname(cachePath), { recursive: true });
      const json = JSON.stringify(fileData, null, 2);
      JSON.parse(json); // verify integrity before writing
      writeFileSync(cachePath, json);
    } catch (err) {
      try {
        if (existsSync(cachePath)) unlinkSync(cachePath);
      } catch {
        /* ignore cleanup failures */
      }
      if (process.env["DEBUG"]) {
        console.warn(`Warning: Failed to write cache file (${(err as Error).message})`);
      }
    }
  }

  /**
   * Reads a cached validation result for a specific (document, spec) pair.
   *
   * Returns null if the cache file doesn't exist, the spec has no entry,
   * or the content hash doesn't match. Handles both v1.0 and v2.0 files.
   */
  read({
    documentPath,
    contentHash,
    specPath,
  }: {
    documentPath: string;
    contentHash: string;
    specPath: string;
  }): CachedValidationResult | null {
    const cachePath = this.cachePathFor(documentPath);

    if (!existsSync(cachePath)) {
      return null;
    }

    try {
      const raw = readFileSync(cachePath, "utf-8");
      const fileData = JSON.parse(raw) as { version: string };

      if (fileData.version === CACHE_VERSION) {
        const v2 = fileData as CacheFileDataV2;
        const entry = v2.validations[this.specHash(specPath)];
        if (!entry || entry.content_hash !== contentHash) return null;
        return entry.result;
      }

      if (fileData.version === CACHE_VERSION_V1) {
        const v1 = fileData as CacheFileDataV1;
        if (this.specHash(v1.document.spec_path) !== this.specHash(specPath)) return null;
        if (v1.content_hash !== contentHash) return null;
        return v1.result;
      }

      return null;
    } catch (err) {
      try {
        unlinkSync(cachePath);
      } catch {
        /* ignore */
      }
      if (process.env["DEBUG"]) {
        console.warn(
          `Warning: Removed corrupt cache file ${cachePath} (${(err as Error).message})`,
        );
      }
      return null;
    }
  }

  /**
   * Reads a single cached validation result without hash validation.
   *
   * When `specPath` is provided, returns the entry for that spec.
   * When omitted, returns the first entry found (useful for single-spec documents).
   * Returns null if no cache file exists or no matching entry is found.
   * Does not delete corrupt files (purely read-only).
   */
  readRaw({
    documentPath,
    specPath,
  }: {
    documentPath: string;
    specPath?: string;
  }): CacheFileData | null {
    const cachePath = this.cachePathFor(documentPath);

    if (!existsSync(cachePath)) {
      return null;
    }

    try {
      const raw = readFileSync(cachePath, "utf-8");
      const fileData = JSON.parse(raw) as { version: string };

      if (fileData.version === CACHE_VERSION) {
        const v2 = fileData as CacheFileDataV2;
        const entry = specPath
          ? v2.validations[this.specHash(specPath)]
          : Object.values(v2.validations)[0];
        if (!entry) return null;
        return this.entrytoCacheFileData(documentPath, entry);
      }

      if (fileData.version === CACHE_VERSION_V1) {
        const v1 = fileData as CacheFileDataV1;
        if (specPath && this.specHash(v1.document.spec_path) !== this.specHash(specPath)) {
          return null;
        }
        return v1 as CacheFileData;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Reads all cached validation results for a document across all specs.
   *
   * Returns one CacheFileData per spec that has a cached entry. Returns
   * an empty array if no cache file exists or it is unreadable.
   */
  readAllRaw({ documentPath }: { documentPath: string }): CacheFileData[] {
    const cachePath = this.cachePathFor(documentPath);

    if (!existsSync(cachePath)) {
      return [];
    }

    try {
      const raw = readFileSync(cachePath, "utf-8");
      const fileData = JSON.parse(raw) as { version: string };

      if (fileData.version === CACHE_VERSION) {
        const v2 = fileData as CacheFileDataV2;
        return Object.values(v2.validations).map((entry) =>
          this.entrytoCacheFileData(documentPath, entry),
        );
      }

      if (fileData.version === CACHE_VERSION_V1) {
        return [fileData as CacheFileData];
      }

      return [];
    } catch {
      return [];
    }
  }

  /**
   * Returns statistics about the current cache.
   */
  stats(): { totalFiles: number; totalSize: number; byType: Record<string, number> } {
    const cacheFiles = fg.sync("**/*.json", { cwd: this.cacheRoot, absolute: true });

    let totalSize = 0;
    const byType: Record<string, number> = {};

    for (const file of cacheFiles) {
      try {
        const stat = readFileSync(file);
        totalSize += stat.length;
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
   * @param root - Project root directory
   * @param sources - Array of source directory paths relative to root
   */
  orphanedCacheFiles(
    root: string,
    sources: string[],
    specFilePattern: string = DEFAULT_SPEC_FILE_PATTERN,
  ): OrphanedCacheFile[] {
    const validDocuments = this.buildDocumentMap(root, sources, specFilePattern);
    const orphans: OrphanedCacheFile[] = [];
    const cacheFiles = fg.sync("**/*.json", { cwd: this.cacheRoot, absolute: true });

    for (const cacheFile of cacheFiles) {
      const docName = basename(cacheFile, ".json");
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
    const root = this.projectRoot ?? process.cwd();
    return join(root, ".praxis", "cache", "validation");
  }

  /**
   * Loads an existing cache file and returns a v2.0 structure.
   *
   * If the file is v1.0, migrates it to v2.0 in memory by seeding the
   * existing entry under its spec hash. If the file is absent or corrupt,
   * returns a fresh empty v2.0 structure.
   */
  private loadOrMigrate(cachePath: string): CacheFileDataV2 {
    const empty: CacheFileDataV2 = { version: "2.0", validations: {} };

    if (!existsSync(cachePath)) return empty;

    try {
      const raw = readFileSync(cachePath, "utf-8");
      const fileData = JSON.parse(raw) as { version: string };

      if (fileData.version === CACHE_VERSION) {
        return fileData as CacheFileDataV2;
      }

      if (fileData.version === CACHE_VERSION_V1) {
        const v1 = fileData as CacheFileDataV1;
        const key = this.specHash(v1.document.spec_path);
        return {
          version: "2.0",
          validations: {
            [key]: {
              spec_path: v1.document.spec_path,
              document_type: v1.document.type,
              cached_at: v1.cached_at,
              content_hash: v1.content_hash,
              result: v1.result,
            },
          },
        };
      }
    } catch {
      /* corrupt file — start fresh */
    }

    return empty;
  }

  /** Constructs a CacheFileData view from a SpecCacheEntry (for backwards-compat callers). */
  private entrytoCacheFileData(documentPath: string, entry: SpecCacheEntry): CacheFileData {
    return {
      version: CACHE_VERSION,
      cached_at: entry.cached_at,
      content_hash: entry.content_hash,
      document: {
        path: documentPath,
        type: entry.document_type,
        spec_path: entry.spec_path,
      },
      result: entry.result,
    };
  }

  /**
   * Computes an 8-char SHA256 hash of the spec's project-relative path.
   *
   * Used as the key in the v2.0 validations map. Normalizing to a
   * project-relative path before hashing ensures stability across machines.
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
  private buildDocumentMap(root: string, sources: string[], specFilePattern: string): Set<string> {
    const documents = new Set<string>();

    for (const source of sources) {
      const sourceDir = join(root, source);
      if (!existsSync(sourceDir)) continue;

      const docFiles = fg.sync("**/*.md", { cwd: sourceDir, absolute: false });

      for (const relFile of docFiles) {
        const name = basename(relFile);
        if (isSpecFile(name, specFilePattern) || basename(relFile, ".md").startsWith("_")) continue;

        const key = join(source, relFile).replace(/\.md$/, "");
        documents.add(key);
      }
    }

    return documents;
  }
}

/**
 * Computes a cache-key hash from document and readme content.
 *
 * Returns the first 8 characters of the SHA256 hex digest, matching
 * the Ruby implementation's behavior for cache compatibility.
 */
export function contentHash(documentContent: string, readmeContent: string): string {
  return createHash("sha256")
    .update(documentContent + readmeContent)
    .digest("hex")
    .slice(0, 8);
}

/**
 * Strips control characters and double quotes from a string to prevent
 * malformed JSON in cache files. Preserves newlines, carriage returns, and tabs.
 */
function sanitizeText(text: string): string {
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").replace(/"/g, "'");
}
