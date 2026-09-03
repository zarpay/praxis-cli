import type { StoreProblem } from "@/types.js";

import fg from "fast-glob";

import { exists, matchesFilename, readText } from "@/helpers/files-helper.js";
import { baseName } from "@/helpers/paths-helper.js";
import { ExpertFile } from "@/models/expert-file.js";

/**
 * The experts directory: the spec layer's source definitions (11).
 *
 * One handle owns the listing rules — a spec file is direction and an
 * underscore-prefixed file is a template, so neither is ever an expert
 * — and the sweeps over them. One malformed file never takes down a
 * sweep: `all()` reports it in `problems`, and `byAlias` walks past it
 * (compiling it is what should surface its error, with the full
 * message, not a search that happened past it).
 */
export class ExpertStore {
  private readonly expertsDir: string;
  private readonly specFilePattern: string;
  private readonly ignore: string[];

  constructor({
    expertsDir,
    specFilePattern,
    ignore = [],
  }: {
    /** Absolute path of the experts directory. */
    expertsDir: string;
    /** Spec filename or glob, never listed as an expert. */
    specFilePattern: string;
    /** Absolute glob patterns to exclude, from the project's ignore config. */
    ignore?: string[];
  }) {
    this.expertsDir = expertsDir;
    this.specFilePattern = specFilePattern;
    this.ignore = ignore;
  }

  /** Absolute paths of every expert document, sorted. */
  files(): string[] {
    if (!exists(this.expertsDir)) return [];

    return fg
      .sync("*.md", { cwd: this.expertsDir, onlyFiles: true, absolute: true, ignore: this.ignore })
      .filter((path) => !matchesFilename(path, this.specFilePattern))
      .filter((path) => !baseName(path).startsWith("_"))
      .sort();
  }

  /** Every expert, validated; one malformed file never hides the rest. */
  all(): { experts: ExpertFile[]; problems: StoreProblem[] } {
    const experts: ExpertFile[] = [];
    const problems: StoreProblem[] = [];

    for (const path of this.files()) {
      try {
        experts.push(ExpertFile.fromContent(readText(path), path));
      } catch (err) {
        problems.push({ path, message: err instanceof Error ? err.message : String(err) });
      }
    }

    return { experts, problems };
  }

  /**
   * The expert declaring an alias, or null when none does. Matches
   * case-insensitively, because an alias is a name a person types.
   */
  byAlias(alias: string): ExpertFile | null {
    const wanted = alias.toLowerCase();

    return this.all().experts.find((expert) => expert.alias.toLowerCase() === wanted) ?? null;
  }
}
