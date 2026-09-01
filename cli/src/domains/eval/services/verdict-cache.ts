import type {
  AssistFileRecord,
  CacheFileData,
  CacheReviewerIdentity,
  Verdict,
  VerdictEntry,
} from "@/domains/eval/types.js";

import { PraxisBase } from "@/core/base.js";
import { exists, readText, removeFile, writeText } from "@/core/files.js";
import { baseName, joinPath, parentDir } from "@/core/paths.js";
import { CACHE_VERSION, VerdictCacheFile } from "@/domains/eval/models/verdict-cache-file.js";

/**
 * The verdict store, bound to one reviewer.
 *
 * A repository over `.praxis/cache/validation/`: one JSON file per
 * target, mirroring the target's project path. The file itself is a
 * `VerdictCacheFile` — this owns only where it lives, which reviewer's
 * entries to read, and the I/O.
 *
 * Every failure degrades to a miss. A cache that cannot be read costs
 * an API call; a cache that raises would cost the run.
 */
export class CacheManager extends PraxisBase {
  /** Directory all cache files live under (default: {root}/.praxis/cache/validation). */
  readonly cacheRoot: string;
  private readonly projectRoot: string | null;
  private readonly reviewer: CacheReviewerIdentity | null;

  constructor({
    cacheRoot,
    projectRoot,
    reviewer,
  }: {
    /** Base cache directory; defaults to {projectRoot}/.praxis/cache/validation. */
    cacheRoot?: string;
    /** Project root for relative cache paths and default locations. */
    projectRoot?: string;
    /** The reviewer whose verdicts this manager reads and writes. */
    reviewer?: CacheReviewerIdentity;
  } = {}) {
    super();
    this.projectRoot = projectRoot ?? null;
    this.cacheRoot =
      cacheRoot ?? joinPath(projectRoot ?? process.cwd(), ".praxis/cache/validation");
    this.reviewer = reviewer ?? null;
  }

  /**
   * Where a target's cache file lives.
   *
   * Mirrors the target's project-relative path, so the committed cache
   * reads like the tree it describes.
   */
  cachePathFor(targetPath: string): string {
    const relative = this.relativeToRoot(targetPath);

    return joinPath(this.cacheRoot, parentDir(relative), `${baseName(relative, ".md")}.json`);
  }

  /**
   * Stores this reviewer's verdict for a (target, spec) pair.
   *
   * Other specs' and reviewers' entries are preserved. Silently fails
   * on I/O errors: a verdict that cannot be cached is still a verdict.
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
    const file = this.load(cachePath) ?? VerdictCacheFile.empty();
    const specPath = this.relativeToRoot(metadata.specPath);

    file.put(VerdictCacheFile.keyFor(specPath, this.identity().hash), {
      reviewer: this.identity(),
      spec_path: specPath,
      cached_at: new Date().toISOString(),
      content_hash: contentHash,
      result: {
        ...result,
        reason: sanitizeText(result.reason),
        issues: result.issues.map(sanitizeText),
      },
      ...(metadata.exemplarFiles?.length ? { exemplar_files: metadata.exemplarFiles } : {}),
      ...(metadata.contextFiles?.length ? { context_files: metadata.contextFiles } : {}),
    });

    try {
      writeText(cachePath, file.toJson());
    } catch (err) {
      this.discard(cachePath, `Failed to write cache file (${(err as Error).message})`);
    }
  }

  /**
   * This reviewer's cached verdict for a (target, spec) pair.
   *
   * Null when the file is absent, the entry is missing, or the inputs
   * have changed since it was written. A corrupt file is discarded so
   * the next write starts clean — the read-only accessor below
   * deliberately leaves it alone.
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
    const file = this.load(cachePath, (err) =>
      this.discard(cachePath, `Removed corrupt cache file ${cachePath} (${err.message})`),
    );

    if (!file) return null;

    const key = VerdictCacheFile.keyFor(this.relativeToRoot(specPath), this.identity().hash);
    const entry = file.entry(key);

    if (entry?.content_hash !== contentHash) return null;

    return entry.result;
  }

  /**
   * One stored verdict, without checking whether it is still current.
   *
   * What `praxis eval verdict` and `praxis status` read: they report
   * what was recorded, staleness included, and make no API call. With
   * no `specPath` they take this reviewer's first entry, which is what
   * a single-spec target has.
   */
  readRaw({
    targetPath,
    specPath,
  }: {
    targetPath: string;
    specPath?: string;
  }): CacheFileData | null {
    const file = this.load(this.cachePathFor(targetPath));

    if (!file) return null;

    const entries = file.entriesFor(this.identity());
    const wanted = specPath
      ? VerdictCacheFile.keyFor(this.relativeToRoot(specPath), this.identity().hash)
      : null;
    const entry = wanted
      ? entries.find((candidate) => VerdictCacheFile.keyOf(candidate) === wanted)
      : entries[0];

    if (!entry) return null;

    return this.toCacheFileData(targetPath, entry);
  }

  /**
   * Reads a target's cache file, or null when there is nothing usable.
   *
   * Absent, outdated and corrupt files all yield null; `onCorrupt`
   * fires only for a file that exists and fails to parse, so the
   * decision to delete stays with the caller.
   */
  private load(cachePath: string, onCorrupt?: (err: Error) => void): VerdictCacheFile | null {
    if (!exists(cachePath)) return null;

    try {
      return VerdictCacheFile.parse(readText(cachePath));
    } catch (err) {
      onCorrupt?.(err as Error);
      return null;
    }
  }

  /**
   * Removes an unusable cache file, reporting only under DEBUG.
   *
   * The cache degrades silently by design — a miss costs an API call,
   * never a failed run — so its diagnostics are opt-in.
   */
  private discard(cachePath: string, message: string): void {
    try {
      if (exists(cachePath)) removeFile(cachePath);
    } catch {
      /* cleanup failures must never mask the real error */
    }

    if (process.env["DEBUG"]) {
      this.logger.warn(message);
    }
  }

  /** The flattened per-verdict view report consumers read. */
  private toCacheFileData(targetPath: string, entry: VerdictEntry): CacheFileData {
    return {
      version: CACHE_VERSION,
      cached_at: entry.cached_at,
      content_hash: entry.content_hash,
      document: { path: targetPath, spec_path: entry.spec_path },
      result: entry.result,
    };
  }

  /** This manager's reviewer, with a placeholder when unbound (tests). */
  private identity(): CacheReviewerIdentity {
    return this.reviewer ?? { name: "unbound", model: "unbound", hash: "00000000" };
  }

  /**
   * Strips the project root prefix from a path.
   *
   * Both the cache file's location and the stored spec path go through
   * here, so a target and its spec normalize the same way and keys stay
   * stable across machines.
   */
  private relativeToRoot(path: string): string {
    if (!this.projectRoot) return path;

    const root = this.projectRoot.endsWith("/") ? this.projectRoot : `${this.projectRoot}/`;

    return path.startsWith(root) ? path.slice(root.length) : path;
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
