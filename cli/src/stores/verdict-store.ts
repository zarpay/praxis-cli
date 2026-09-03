import type {
  AssistFileRecord,
  CacheFileData,
  CacheReviewerIdentity,
  Verdict,
  VerdictEntry,
} from "@/types.js";

import { exists, readText, removeFile, writeText } from "@/helpers/files-helper.js";
import { baseName, joinPath, parentDir } from "@/helpers/paths-helper.js";
import { CACHE_VERSION, CacheFile } from "@/models/cache-file.js";

/** Stands in for a reviewer when none is bound, which only tests do. */
const UNBOUND: CacheReviewerIdentity = { name: "unbound", model: "unbound", hash: "00000000" };

/**
 * One reviewer's verdict cache: where verdicts live, under what key,
 * and every read and write against them.
 *
 * The cache's contract is fail-soft in both directions — a cache that
 * cannot be read costs an API call, a verdict that cannot be cached is
 * still a verdict — and the two read paths carry different corruption
 * policy: the reviewing read discards a corrupt file so the write that
 * follows starts clean; the reporting read leaves it alone, because
 * looking at a cache must never change it. The file's format is
 * `CacheFile` (a model); this store owns the IO and the policy.
 *
 * Paths are made project-relative before they are used or hashed, so a
 * cache file committed on one machine addresses and hits on another.
 */
export class VerdictStore {
  /** Directory all cache files live under. */
  readonly root: string;
  /** The reviewer whose entries this addresses. */
  readonly reviewer: CacheReviewerIdentity;

  private readonly projectRoot: string | null;

  constructor({
    cacheRoot,
    projectRoot,
    reviewer,
  }: {
    /** Base cache directory; defaults to {projectRoot}/.praxis/cache/validation. */
    cacheRoot?: string;
    /** Project root, which cache and spec paths are made relative to. */
    projectRoot?: string;
    /** The reviewer whose verdicts are addressed; tests may omit it. */
    reviewer?: CacheReviewerIdentity;
  } = {}) {
    this.projectRoot = projectRoot ?? null;
    this.root = cacheRoot ?? joinPath(projectRoot ?? process.cwd(), ".praxis/cache/validation");
    this.reviewer = reviewer ?? UNBOUND;
  }

  /**
   * Where a target's cache file lives.
   *
   * Mirrors the target's project-relative path, so the committed cache
   * reads like the tree it describes.
   */
  pathFor(targetPath: string): string {
    const relative = this.relativeToRoot(targetPath);

    return joinPath(this.root, parentDir(relative), `${baseName(relative, ".md")}.json`);
  }

  /** This reviewer's entry key for one spec. */
  keyFor(specPath: string): string {
    return CacheFile.keyFor(this.relativeToRoot(specPath), this.reviewer.hash);
  }

  /**
   * Strips the project root prefix from a path.
   *
   * Returns the path unchanged when there is no root or the path lies
   * outside it. Both the file's location and the stored spec path go
   * through here, so a target and its spec normalize the same way.
   */
  relativeToRoot(path: string): string {
    if (!this.projectRoot) return path;

    const root = this.projectRoot.endsWith("/") ? this.projectRoot : `${this.projectRoot}/`;

    return path.startsWith(root) ? path.slice(root.length) : path;
  }

  /**
   * This reviewer's cached verdict for a (target, spec) pair, if still
   * current: null when the file is absent, the reviewer has no entry
   * for the spec, or the inputs changed since the verdict was written —
   * the content hash covers everything the reviewer saw. The reviewing
   * path, so a corrupt file is discarded here.
   */
  readVerdict({
    targetPath,
    specPath,
    contentHash,
  }: {
    targetPath: string;
    specPath: string;
    contentHash: string;
  }): Verdict | null {
    const file = this.readFile(this.pathFor(targetPath), { discardCorrupt: true });

    if (!file) return null;

    const entry = file.entry(this.keyFor(specPath));

    if (entry?.content_hash !== contentHash) return null;

    return entry.result;
  }

  /**
   * Stores a verdict for a (target, spec) pair: an upsert, never a
   * replace — one file holds a target's complete review state across
   * specs and reviewers. Silently fails on I/O trouble, discarding a
   * file it could not write rather than leaving a half-written one.
   */
  writeVerdict({
    targetPath,
    specPath,
    contentHash,
    result,
    exemplarFiles,
    contextFiles,
  }: {
    targetPath: string;
    specPath: string;
    contentHash: string;
    result: Verdict;
    exemplarFiles?: AssistFileRecord[];
    contextFiles?: AssistFileRecord[];
  }): void {
    const path = this.pathFor(targetPath);
    const file = this.readFile(path, { discardCorrupt: false }) ?? CacheFile.empty();

    const entry: VerdictEntry = {
      reviewer: this.reviewer,
      spec_path: this.relativeToRoot(specPath),
      cached_at: new Date().toISOString(),
      content_hash: contentHash,
      result: {
        ...result,
        reason: sanitizeText(result.reason),
        issues: result.issues.map((issue) => ({ ...issue, text: sanitizeText(issue.text) })),
      },
      ...(exemplarFiles?.length ? { exemplar_files: exemplarFiles } : {}),
      ...(contextFiles?.length ? { context_files: contextFiles } : {}),
    };

    file.put(this.keyFor(specPath), entry);

    try {
      writeText(path, file.toJson());
    } catch {
      removeQuietly(path);
    }
  }

  /**
   * One stored verdict, without checking whether it is still current —
   * what `praxis eval verdict` and `praxis status` read: they report
   * what was recorded, staleness included. With no `specPath` they take
   * this reviewer's first entry, which is what a single-spec target
   * has. Read-only: a corrupt file is left alone.
   */
  readEntry({
    targetPath,
    specPath,
  }: {
    targetPath: string;
    specPath?: string;
  }): CacheFileData | null {
    const file = this.readFile(this.pathFor(targetPath), { discardCorrupt: false });

    if (!file) return null;

    const entries = file.entriesFor(this.reviewer);
    const entry = specPath
      ? entries.find((candidate) => CacheFile.keyOf(candidate) === this.keyFor(specPath))
      : entries[0];

    if (!entry) return null;

    return {
      version: CACHE_VERSION,
      cached_at: entry.cached_at,
      content_hash: entry.content_hash,
      document: { path: targetPath, spec_path: entry.spec_path },
      result: entry.result,
    };
  }

  /**
   * A target's cache file, or null when nothing usable exists. Absent,
   * outdated and corrupt files all yield null; a corrupt file is
   * deleted only on the reviewing path. Never raises.
   */
  private readFile(
    path: string,
    { discardCorrupt }: { discardCorrupt: boolean },
  ): CacheFile | null {
    if (!exists(path)) return null;

    try {
      return CacheFile.parse(readText(path));
    } catch {
      if (discardCorrupt) removeQuietly(path);

      return null;
    }
  }
}

/** Deletes a file, ignoring failures: cleanup must never mask the real problem. */
function removeQuietly(path: string): void {
  try {
    if (exists(path)) removeFile(path);
  } catch {
    /* the file being unusable is already handled by the caller */
  }
}

/**
 * Strips control characters and double quotes to keep stored JSON well
 * formed. Preserves newlines, carriage returns, and tabs.
 */
function sanitizeText(text: string): string {
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").replace(/"/g, "'");
}
