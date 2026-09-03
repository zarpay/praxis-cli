import type { Frontmatter } from "@/models/frontmatter.js";

import { MarkdownFile } from "@/models/markdown-file.js";

/**
 * Any Praxis markdown document, read for the two fields that classify
 * it rather than for what its kind can do.
 *
 * `praxis status` sweeps whole source trees counting documents by
 * `type:`; it cannot know in advance
 * which kind each file is, and constructing the wrong specific model
 * would raise on fields that file was never meant to carry. This is the
 * reader for that sweep — the shared fields, both optional.
 *
 * Reach for `ExpertFile` or `SpecFile` whenever the kind *is* known:
 * they validate the whole document, this validates only what it reads.
 *
 * @throws PraxisError when `type` is present but not a string
 */
export class DocumentFile {
  /** Absolute path to the document. */
  readonly path: string;
  /** The document's declared kind: expert, practice, reference, … */
  readonly type: string | undefined;

  private constructor(fields: Frontmatter, path: string) {
    this.path = path;
    this.type = fields.optionalString("type");
  }

  /** Reads a document from already-loaded content. */
  static fromContent(content: string, path: string): DocumentFile {
    return new DocumentFile(MarkdownFile.fromContent(content, path).frontmatter, path);
  }
}
