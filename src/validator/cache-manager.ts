import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import fg from "fast-glob";

import { DEFAULT_SPEC_FILE_PATTERN } from "@/core/config.js";

import { isSpecFile } from "./spec-pattern.js";

/** Cache format version for backwards-compatibility checks. */
const CACHE_VERSION = "1.0";

/** Severity level for validation issues. */
export type Severity = "warning" | "error";

/** Result of a single document validation, as stored in cache. */
export interface CachedValidationResult {
  compliant: boolean;
  issues: string[];
  reason: string;
  severity?: Severity;
}

/** Full cache file structure written to disk. */
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
 * organized by document type. Each file contains a content hash that
 * auto-invalidates the cache when either the document or its README
 * specification changes.
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
   * Creates parent directories as needed. Sanitizes LLM-generated text
   * and verifies JSON integrity before writing. Silently fails on I/O errors.
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

    const sanitizedResult: CachedValidationResult = {
      ...result,
      reason: sanitizeText(result.reason),
      issues: result.issues.map(sanitizeText),
    };

    const cacheData: CacheFileData = {
      version: CACHE_VERSION,
      cached_at: new Date().toISOString(),
      content_hash: contentHash,
      document: {
        path: documentPath,
        type: metadata.documentType,
        spec_path: metadata.specPath,
      },
      result: sanitizedResult,
    };

    try {
      mkdirSync(dirname(cachePath), { recursive: true });
      const json = JSON.stringify(cacheData, null, 2);
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
   * Reads a cached validation result if one exists and is valid.
   *
   * Returns null if the cache file doesn't exist, has a version
   * mismatch, or the content hash doesn't match.
   */
  read({
    documentPath,
    contentHash,
  }: {
    documentPath: string;
    contentHash: string;
  }): CachedValidationResult | null {
    const cachePath = this.cachePathFor(documentPath);

    if (!existsSync(cachePath)) {
      return null;
    }

    try {
      const raw = readFileSync(cachePath, "utf-8");
      const cached = JSON.parse(raw) as CacheFileData;

      if (cached.version !== CACHE_VERSION) {
        return null;
      }
      if (cached.content_hash !== contentHash) {
        return null;
      }

      return cached.result;
    } catch (err) {
      try {
        unlinkSync(cachePath);
      } catch {
        /* ignore */
      }
      if (process.env["DEBUG"]) {
        console.warn(`Warning: Removed corrupt cache file ${cachePath} (${(err as Error).message})`);
      }
      return null;
    }
  }

  /**
   * Reads the raw cache file data without hash validation.
   *
   * Unlike `read()`, this does not require a content hash and does not
   * reject on hash mismatch. Returns the full cache file structure or
   * null if no cache file exists or is unreadable. Does not delete
   * corrupt files (purely read-only).
   */
  readRaw({ documentPath }: { documentPath: string }): CacheFileData | null {
    const cachePath = this.cachePathFor(documentPath);

    if (!existsSync(cachePath)) {
      return null;
    }

    try {
      const raw = readFileSync(cachePath, "utf-8");
      const cached = JSON.parse(raw) as CacheFileData;

      if (cached.version !== CACHE_VERSION) {
        return null;
      }

      return cached;
    } catch {
      return null;
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
  return createHash("sha256").update(documentContent + readmeContent).digest("hex").slice(0, 8);
}

/**
 * Strips control characters and double quotes from a string to prevent
 * malformed JSON in cache files. Preserves newlines, carriage returns, and tabs.
 */
function sanitizeText(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/"/g, "'");
}
