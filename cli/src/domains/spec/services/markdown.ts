import { readText } from "@/core/files.js";
import { Frontmatter } from "@/core/frontmatter.js";

/**
 * Extracts the body content from a markdown file, stripping frontmatter.
 *
 * A thin file-reading wrapper over `Frontmatter.body()` — the delimiter
 * format has one implementation, in the parser that owns it.
 */
export class Markdown {
  private readonly fm: Frontmatter;

  constructor(filePath: string) {
    this.fm = Frontmatter.fromContent(readText(filePath));
  }

  /**
   * Returns the markdown body with leading and trailing whitespace trimmed.
   *
   * This is the primary accessor for inlining content during compilation.
   */
  body(): string {
    return this.bodyRaw().trim();
  }

  /** Returns the raw markdown body preserving original whitespace. */
  bodyRaw(): string {
    return this.fm.body();
  }
}
