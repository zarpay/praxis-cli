import { errors } from "@/helpers/errors-helper.js";
import { exists } from "@/helpers/files-helper.js";
import { joinPath, parentDir, resolvePath } from "@/helpers/paths-helper.js";

/**
 * Resolved path to the scaffold directory shipped with the package.
 *
 * At runtime, `import.meta.dirname` resolves to `dist/` (the built,
 * bundled output), and the scaffold directory sits one level up at the
 * package root. Tests inject their own scaffold path instead.
 */
export const SCAFFOLD_DIR = joinPath(import.meta.dirname, "..", "scaffold");

/** Name of the marker directory that defines a Praxis project root. */
export const PRAXIS_DIR_NAME = ".praxis";

/** The `.praxis/` directory for a given project root. */
export function praxisDir(root: string): string {
  return joinPath(root, PRAXIS_DIR_NAME);
}

/** The config file path for a given project root. */
export function configFile(root: string): string {
  return joinPath(praxisDir(root), "config.json");
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

  /**
   * Resolves a relative path against the project root.
   *
   * @param relativePath - Path relative to the project root
   */
  resolve(relativePath: string): string {
    return joinPath(this.root, relativePath);
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
    let current = resolvePath(this.startDir);

    for (;;) {
      if (exists(joinPath(current, PRAXIS_DIR_NAME))) {
        return current;
      }

      const parent = parentDir(current);

      if (parent === current) {
        throw errors.rootNotFound();
      }

      current = parent;
    }
  }
}
