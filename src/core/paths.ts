import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { errors } from "./errors.js";

/**
 * Resolves the project root within a Praxis project.
 *
 * Finds the project root by walking up the filesystem until a `.praxis/`
 * directory is found (the defining marker of a Praxis project), then
 * provides helpers for resolving paths relative to that root.
 */
export class Paths {
  private readonly startDir: string;
  private cachedRoot: string | null = null;

  constructor(startDir: string = process.cwd()) {
    this.startDir = startDir;
  }

  /** The project root directory (parent of `.praxis/`). */
  get root(): string {
    this.cachedRoot ??= this.findRoot();
    return this.cachedRoot;
  }

  /**
   * Resolves a relative path against the project root.
   *
   * @param relativePath - Path relative to the project root
   */
  resolve(relativePath: string): string {
    return join(this.root, relativePath);
  }

  /**
   * Converts an absolute path to a path relative to the project root.
   *
   * @param absolutePath - Absolute filesystem path
   */
  relative(absolutePath: string): string {
    const prefix = this.root + "/";
    if (absolutePath.startsWith(prefix)) {
      return absolutePath.slice(prefix.length);
    }
    return absolutePath;
  }

  /**
   * Walks up from startDir to find the nearest `.praxis/` directory.
   *
   * @throws Error if no `.praxis/` directory is found before reaching filesystem root
   */
  private findRoot(): string {
    let current = resolve(this.startDir);

    for (;;) {
      if (existsSync(join(current, ".praxis"))) {
        return current;
      }

      const parent = dirname(current);
      if (parent === current) {
        throw errors.rootNotFound();
      }

      current = parent;
    }
  }
}
