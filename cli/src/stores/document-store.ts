import type { PraxisConfig } from "@/models/praxis-config.js";

import fg from "fast-glob";

import { isContentFile, readText } from "@/helpers/files-helper.js";
import { joinPath } from "@/helpers/paths-helper.js";
import { DocumentFile } from "@/models/document-file.js";

/** How many documents of each non-authored kind a project holds. */
interface DocumentCounts {
  references: number;
  context: number;
}

/**
 * The source trees' documents, swept untyped: every authored markdown
 * file, read as a `DocumentFile` because a sweep cannot know in advance
 * what each file is.
 *
 * The other document stores each own one directory of one kind; this
 * one owns the sweep across every source directory — the listing rules
 * (a spec file is direction and an underscore-prefixed file is a
 * template, so neither is a document; ignore patterns honored; a
 * missing directory yields nothing, because an unused part of the
 * taxonomy is a normal state), the classifying counts `praxis status`
 * reports, and the run-summary denominator: a document no spec covers
 * is "not validated", not invisible.
 */
export class DocumentStore {
  private readonly root: string;
  private readonly sources: string[];
  private readonly specFilePattern: string;
  private readonly ignore: string[];

  constructor(cfg: PraxisConfig) {
    this.root = cfg.root;
    this.sources = cfg.sources;
    this.specFilePattern = cfg.specFilePattern;
    this.ignore = cfg.absoluteIgnore;
  }

  /** Absolute paths of every document across the source directories. */
  files(): string[] {
    return this.sources.flatMap((source) =>
      fg
        .sync("**/*.md", {
          cwd: joinPath(this.root, source),
          onlyFiles: true,
          absolute: true,
          dot: true,
          ignore: this.ignore,
        })
        .filter((file) => isContentFile(file, this.specFilePattern)),
    );
  }

  /**
   * Counts the reference and context documents across the source trees.
   *
   * Classification comes from each document's own `type:`. Conventions
   * and constitutions are both context — they differ in scope, not in
   * what they are to a reader — so they are counted together.
   */
  countsByType(): DocumentCounts {
    let references = 0;
    let context = 0;

    for (const file of this.files()) {
      const type = DocumentFile.fromContent(readText(file), file).type;

      if (type === "reference") references++;
      else if (type === "convention" || type === "constitution") context++;
    }

    return { references, context };
  }
}
