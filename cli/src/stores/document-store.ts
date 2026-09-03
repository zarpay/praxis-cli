import type { DocumentCounts } from "@/types.js";

import fg from "fast-glob";

import { isContentFile, readText } from "@/helpers/files-helper.js";
import { joinPath } from "@/helpers/paths-helper.js";
import { DocumentFile } from "@/models/document-file.js";
import { DEFAULT_SPEC_FILE_PATTERN } from "@/models/praxis-config.js";

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

  constructor({
    root,
    sources,
    specFilePattern = DEFAULT_SPEC_FILE_PATTERN,
    ignore = [],
  }: {
    /** Project root the source directories resolve against. */
    root: string;
    /** Source directories, relative to the root. */
    sources: string[];
    /** Spec filename or glob, never listed as a document. */
    specFilePattern?: string;
    /** Absolute glob patterns to exclude, from the project's ignore config. */
    ignore?: string[];
  }) {
    this.root = root;
    this.sources = sources;
    this.specFilePattern = specFilePattern;
    this.ignore = ignore;
  }

  /** Absolute paths of every document across the source directories. */
  paths(): string[] {
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

    for (const file of this.paths()) {
      const type = DocumentFile.fromContent(readText(file), file).type;

      if (type === "reference") references++;
      else if (type === "convention" || type === "constitution") context++;
    }

    return { references, context };
  }
}
