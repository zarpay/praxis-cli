import fg from "fast-glob";

import { exists } from "@/core/files.js";
import { baseName, resolvePath } from "@/core/paths.js";
import { isSpecFile } from "@/core/spec-pattern.js";
import { DocumentFile } from "@/domains/workspace/models/document-file.js";

/**
 * Finds the authored documents in a project and classifies them.
 *
 * The workspace view of the tree: what documents exist and what kind
 * each declares itself to be. It never opens a document as a specific
 * kind, because a sweep cannot know in advance which kind a file is —
 * `DocumentFile` reads only the fields every document may carry.
 *
 * A spec file is not an authored document, and an underscore-prefixed
 * file is a template; neither is ever counted.
 */
export class DocumentDiscovery {
  private readonly root: string;
  private readonly specFilePattern: string;
  /** Ignore patterns resolved to absolute paths for fast-glob. */
  private readonly absoluteIgnore: string[];

  constructor({
    root,
    specFilePattern,
    ignore = [],
  }: {
    root: string;
    specFilePattern: string;
    ignore?: string[];
  }) {
    this.root = root;
    this.specFilePattern = specFilePattern;
    this.absoluteIgnore = ignore.map((p) => resolvePath(root, p));
  }

  /**
   * The .md documents in a directory.
   *
   * @param dir - Absolute directory path; a missing directory yields nothing
   * @param recursive - Whether to descend into subdirectories
   */
  async list(dir: string, recursive: boolean): Promise<string[]> {
    if (!exists(dir)) return [];

    const files = await fg(recursive ? "**/*.md" : "*.md", {
      cwd: dir,
      onlyFiles: true,
      absolute: true,
      ignore: this.absoluteIgnore,
    });

    return files.filter(
      (f) => !isSpecFile(f, this.specFilePattern) && !baseName(f).startsWith("_"),
    );
  }

  /**
   * Counts reference and context documents across the source trees.
   *
   * Classification comes from each document's `type:`; conventions and
   * constitutions are both context, which is why they are counted
   * together rather than reported separately.
   *
   * @param sources - Source directories, relative to the project root
   */
  async countByType(sources: string[]): Promise<{ references: number; context: number }> {
    let references = 0;
    let context = 0;

    for (const source of sources) {
      const files = await this.list(resolvePath(this.root, source), true);

      for (const file of files) {
        const type = DocumentFile.at(file).type;

        if (type === "reference") references++;
        else if (type === "convention" || type === "constitution") context++;
      }
    }

    return { references, context };
  }
}
