import { readText } from "@/core/files.js";

/** Delimiter used to fence YAML frontmatter in markdown files. */
const DELIMITER = "---";

/**
 * Extracts the body content from a markdown file, stripping frontmatter.
 *
 * Handles files with or without YAML frontmatter. For files with
 * frontmatter, returns everything after the closing `---` delimiter.
 * For files without, returns the entire content.
 */
export class Markdown {
  private readonly content: string;

  constructor(filePath: string) {
    this.content = readText(filePath);
  }

  /**
   * Returns the markdown body with leading and trailing whitespace trimmed.
   *
   * This is the primary accessor for inlining content during compilation.
   */
  body(): string {
    return this.bodyRaw().trim();
  }

  /**
   * Returns the raw markdown body preserving original whitespace.
   *
   * If the file has frontmatter, returns everything after the closing
   * `---` delimiter. If not, returns the entire file content.
   */
  bodyRaw(): string {
    if (!this.hasFrontmatter()) {
      return this.content;
    }

    const endIndex = this.content.indexOf(`\n${DELIMITER}`, DELIMITER.length);

    if (endIndex === -1) {
      return this.content;
    }

    const startOfBody = endIndex + DELIMITER.length + 2;
    return this.content.slice(startOfBody);
  }

  /** Checks whether the file content starts with a frontmatter delimiter. */
  private hasFrontmatter(): boolean {
    return this.content.startsWith(`${DELIMITER}\n`);
  }
}
