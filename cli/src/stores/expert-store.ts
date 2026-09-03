import type { PraxisConfig } from "@/models/praxis-config.js";
import type { AddDocumentResult, StoreProblem } from "@/types.js";

import fg from "fast-glob";

import { errors } from "@/helpers/errors-helper.js";
import { exists, matchesFilename, readText, writeText } from "@/helpers/files-helper.js";
import { baseName, joinPath, relativePath } from "@/helpers/paths-helper.js";
import { kebabToTitleCase } from "@/helpers/text-helper.js";
import { ExpertFile } from "@/models/expert-file.js";
import expertFileTemplate from "@/templates/expert-file-template.js";

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
  private readonly root: string;
  private readonly expertsDir: string;
  private readonly specFilePattern: string;
  private readonly ignore: string[];

  constructor(config: PraxisConfig) {
    this.root = config.root;
    this.expertsDir = config.expertsDir;
    this.specFilePattern = config.specFilePattern;
    this.ignore = config.absoluteIgnore;
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
   * Scaffolds one expert from its template — the taxonomy's entry
   * point, so an author starts from the shape the compiler expects
   * rather than a blank file. Refuses to overwrite: an existing
   * document is the author's work, and `add` is not the command for
   * editing it.
   *
   * @param name - Kebab-case name for the new file
   * @throws PraxisError when the target already exists
   */
  add(name: string): AddDocumentResult {
    const targetFile = joinPath(this.expertsDir, `${name}.md`);
    const path = relativePath(this.root, targetFile);

    if (exists(targetFile)) {
      throw errors.fileAlreadyExists(path);
    }

    const document = expertFileTemplate({ title: kebabToTitleCase(name), alias: name });

    writeText(targetFile, document);

    return { type: "expert", path };
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
