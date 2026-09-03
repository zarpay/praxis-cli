import type { PraxisConfig } from "@/models/praxis-config.js";
import type { AddDocumentResult, StoreProblem } from "@/types.js";

import fg from "fast-glob";

import { errors } from "@/helpers/errors-helper.js";
import { exists, matchesFilename, readText, writeText } from "@/helpers/files-helper.js";
import { baseName, joinPath, relativePath } from "@/helpers/paths-helper.js";
import { kebabToTitleCase } from "@/helpers/text-helper.js";
import { PracticeFile } from "@/models/practice-file.js";
import practiceFileTemplate from "@/templates/practice-file-template.js";

/**
 * The practices directory: the recurring pieces of work experts own
 * and inline (vocabulary).
 *
 * Same listing rules as every document store: spec files and
 * underscore-prefixed templates are never practices, and one malformed
 * file is reported, never fatal to the sweep.
 */
export class PracticeStore {
  private readonly root: string;
  private readonly practicesDir: string;
  private readonly specFilePattern: string;
  private readonly ignore: string[];

  constructor(config: PraxisConfig) {
    this.root = config.root;
    this.practicesDir = config.practicesDir;
    this.specFilePattern = config.specFilePattern;
    this.ignore = config.absoluteIgnore;
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

  /**
   * Scaffolds one practice from its template, so an author starts from
   * the shape the compiler expects rather than a blank file. Refuses to
   * overwrite: an existing document is the author's work.
   *
   * @param name - Kebab-case name for the new file
   * @throws PraxisError when the target already exists
   */
  add(name: string): AddDocumentResult {
    const targetFile = joinPath(this.practicesDir, `${name}.md`);
    const path = relativePath(this.root, targetFile);

    if (exists(targetFile)) {
      throw errors.fileAlreadyExists(path);
    }

    const document = practiceFileTemplate({ title: kebabToTitleCase(name) });

    writeText(targetFile, document);

    return { type: "practice", path };
  }

  /**
   * Practices no expert references, by filename. An orphan is a
   * practice that exists but nothing points at, which means no compiled
   * agent carries it — it is written but not in force.
   *
   * @param referenced - Project-relative paths some expert points at
   */
  orphans(referenced: Set<string>): string[] {
    return this.files()
      .filter((file) => !referenced.has(relativePath(this.root, file)))
      .map((file) => baseName(file));
  }

  /** Every practice, validated; one malformed file never hides the rest. */
  all(): { practices: PracticeFile[]; problems: StoreProblem[] } {
    const practices: PracticeFile[] = [];
    const problems: StoreProblem[] = [];

    for (const path of this.files()) {
      try {
        practices.push(PracticeFile.fromContent(readText(path), path));
      } catch (err) {
        problems.push({ path, message: err instanceof Error ? err.message : String(err) });
      }
    }

    return { practices, problems };
  }
}
