import { basename, dirname, join, relative, resolve } from "node:path";

import { errors } from "@/core/errors.js";
import { exists } from "@/core/files.js";

/**
 * Standard path operations for the project.
 *
 * Alongside the well-known Praxis locations below, this module is the
 * single home for path composition: outside of core/files.ts and this
 * file, code imports these helpers instead of node:path (enforced by
 * ESLint's no-restricted-imports).
 */

/** Joins path segments (see node:path join). */
export function joinPath(...segments: string[]): string {
  return join(...segments);
}

/** Resolves path segments to an absolute path (see node:path resolve). */
export function resolvePath(...segments: string[]): string {
  return resolve(...segments);
}

/** The relative path from one location to another (see node:path relative). */
export function relativePath(from: string, to: string): string {
  return relative(from, to);
}

/** The last segment of a path, optionally with an extension stripped. */
export function baseName(path: string, ext?: string): string {
  return basename(path, ext);
}

/** The directory containing a path (see node:path dirname). */
export function parentDir(path: string): string {
  return dirname(path);
}

/**
 * Resolved path to the scaffold directory shipped with the package.
 *
 * At runtime, `import.meta.dirname` resolves to `dist/` (the built,
 * bundled output), and the scaffold directory sits one level up at the
 * package root. Tests inject their own scaffold path instead.
 */
export const SCAFFOLD_DIR = join(import.meta.dirname, "..", "scaffold");

/** Name of the marker directory that defines a Praxis project root. */
export const PRAXIS_DIR_NAME = ".praxis";

/** The `.praxis/` directory for a given project root. */
export function praxisDir(root: string): string {
  return join(root, PRAXIS_DIR_NAME);
}

/** The config file path for a given project root. */
export function configFile(root: string): string {
  return join(praxisDir(root), "config.json");
}

/** The validation cache root for a given project root. */
export function validationCacheDir(root: string): string {
  return join(praxisDir(root), "cache", "validation");
}

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

  /** The project's `.praxis/` directory. */
  get praxisDir(): string {
    return praxisDir(this.root);
  }

  /** The project's `.praxis/config.json` path. */
  get configFile(): string {
    return configFile(this.root);
  }

  /** The project's validation cache root. */
  get validationCacheDir(): string {
    return validationCacheDir(this.root);
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
      if (exists(join(current, PRAXIS_DIR_NAME))) {
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
