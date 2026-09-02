import type { CacheReviewerIdentity } from "@/eval/types.js";

import { CacheFile } from "@/eval/models/cache-file.js";
import { baseName, joinPath, parentDir } from "@/framework/paths.js";

/** Stands in for a reviewer when none is bound, which only tests do. */
const UNBOUND: CacheReviewerIdentity = { name: "unbound", model: "unbound", hash: "00000000" };

/**
 * Where one reviewer's verdicts live, and under what key.
 *
 * The addressing half of the cache: given a target, which file holds
 * its verdicts, and which entry inside is this reviewer's. The file's
 * contents are `CacheFile`; reading and writing are services.
 *
 * Paths are made project-relative before they are used or hashed, so a
 * cache file committed on one machine addresses and hits on another.
 */
export class VerdictCache {
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
}
