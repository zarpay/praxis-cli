import type { Frontmatter } from "@/models/frontmatter.js";

import { errors } from "@/helpers/errors-helper.js";
import { MarkdownFile } from "@/models/markdown-file.js";

/**
 * A practice document — a recurring piece of work with an objective, a
 * process, and success criteria, owned by an expert and inlined into
 * its compiled profile (vocabulary).
 *
 * Validated on construction like every document model: a PracticeFile
 * that exists is a valid practice.
 *
 * @throws PraxisError when `title` is missing or `type` is not "practice"
 */
export class PracticeFile {
  /** Absolute path to the practice file. */
  readonly path: string;
  /** Display title, e.g. "Review Pull Requests". */
  readonly title: string;
  /** The practice's full text, frontmatter excluded. */
  readonly body: string;

  private constructor(fields: Frontmatter, body: string, path: string) {
    this.path = path;
    this.title = fields.requiredString("title");
    this.body = body;

    const type = fields.requiredString("type");

    if (type !== "practice") {
      throw errors.invalidFrontmatterField("type", path, '"practice"', type);
    }
  }

  /** Reads and validates a practice from disk. */
  static at(path: string): PracticeFile {
    const document = MarkdownFile.at(path);

    return new PracticeFile(document.frontmatter, document.body, path);
  }

  /** Reads and validates a practice from already-loaded content. */
  static fromContent(content: string, path: string): PracticeFile {
    const document = MarkdownFile.fromContent(content, path);

    return new PracticeFile(document.frontmatter, document.body, path);
  }
}
