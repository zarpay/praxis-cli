import type { StoreProblem } from "@/types.js";

import fg from "fast-glob";

import { exists, matchesFilename } from "@/helpers/files-helper.js";
import { baseName } from "@/helpers/paths-helper.js";
import { PracticeFile } from "@/models/practice-file.js";

/**
 * The practices directory: the recurring pieces of work experts own
 * and inline (vocabulary).
 *
 * Same listing rules as every document store: spec files and
 * underscore-prefixed templates are never practices, and one malformed
 * file is reported, never fatal to the sweep.
 */
export class PracticeStore {
  private readonly practicesDir: string;
  private readonly specFilePattern: string;
  private readonly ignore: string[];

  constructor({
    practicesDir,
    specFilePattern,
    ignore = [],
  }: {
    /** Absolute path of the practices directory. */
    practicesDir: string;
    /** Spec filename or glob, never listed as a practice. */
    specFilePattern: string;
    /** Absolute glob patterns to exclude, from the project's ignore config. */
    ignore?: string[];
  }) {
    this.practicesDir = practicesDir;
    this.specFilePattern = specFilePattern;
    this.ignore = ignore;
  }

  /** Absolute paths of every practice document, sorted. */
  files(): string[] {
    if (!exists(this.practicesDir)) return [];

    return fg
      .sync("*.md", {
        cwd: this.practicesDir,
        onlyFiles: true,
        absolute: true,
        ignore: this.ignore,
      })
      .filter((path) => !matchesFilename(path, this.specFilePattern))
      .filter((path) => !baseName(path).startsWith("_"))
      .sort();
  }

  /** Every practice, validated; one malformed file never hides the rest. */
  all(): { practices: PracticeFile[]; problems: StoreProblem[] } {
    const practices: PracticeFile[] = [];
    const problems: StoreProblem[] = [];

    for (const path of this.files()) {
      try {
        practices.push(PracticeFile.at(path));
      } catch (err) {
        problems.push({ path, message: err instanceof Error ? err.message : String(err) });
      }
    }

    return { practices, problems };
  }
}
