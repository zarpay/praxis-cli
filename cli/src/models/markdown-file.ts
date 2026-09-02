import { readText } from "@/helpers/files-helper.js";
import { Frontmatter } from "@/models/frontmatter.js";

/** Delimiter fencing the YAML frontmatter block. */
const DELIMITER = "---";

/**
 * A markdown document: its prose and its metadata.
 *
 * Every Praxis document is this shape — a YAML block between `---`
 * fences, then the content. This class owns that format, so nothing
 * else scans for delimiters, and it is what the domain models
 * (`SpecFile`, `ExpertFile`, `DocumentFile`) are built from.
 *
 * The split is deliberate: a document *has* frontmatter, it is not
 * frontmatter. Ask a file for `.body` when you want what it says, and
 * `.frontmatter` when you want what it declares about itself.
 */
export class MarkdownFile {
  /** The file's full text, frontmatter included. */
  readonly content: string;

  /**
   * How this document is named when one of its values is wrong.
   *
   * Defaults to the path it was read from. A caller with a nicer name —
   * a spec reporting itself project-relative rather than absolute —
   * passes its own.
   */
  readonly name: string;

  private cachedFrontmatter: Frontmatter | null = null;

  private constructor(content: string, name: string) {
    this.content = content;
    this.name = name;
  }

  /** Reads a document from disk. */
  static at(path: string, name: string = path): MarkdownFile {
    return new MarkdownFile(readText(path), name);
  }

  /**
   * Builds a document from already-loaded text.
   *
   * For callers that read the file for other purposes and should not
   * pay for a second filesystem read.
   */
  static fromContent(content: string, name = "<content>"): MarkdownFile {
    return new MarkdownFile(content, name);
  }

  /**
   * What the document declares about itself, read through accessors
   * that validate.
   *
   * Parsed once and reused — most readers ask for several keys.
   */
  get frontmatter(): Frontmatter {
    this.cachedFrontmatter ??= Frontmatter.fromYaml(this.rawYaml, this.name);
    return this.cachedFrontmatter;
  }

  /** The prose, frontmatter stripped and surrounding whitespace trimmed. */
  get body(): string {
    return this.bodyRaw.trim();
  }

  /**
   * The prose exactly as written, frontmatter stripped.
   *
   * A document with no frontmatter is all body.
   */
  get bodyRaw(): string {
    const end = this.frontmatterEnd();

    return end === null ? this.content : this.content.slice(end);
  }

  /**
   * The YAML between the fences, unparsed.
   *
   * Empty when the document has no frontmatter. Useful for debugging
   * and re-serialization.
   */
  get rawYaml(): string {
    const end = this.frontmatterEnd();

    return end === null ? "" : this.content.slice(DELIMITER.length + 1, end - DELIMITER.length - 2);
  }

  /**
   * Index just past the closing fence, or null when there is no
   * frontmatter block to close.
   */
  private frontmatterEnd(): number | null {
    if (!this.content.startsWith(`${DELIMITER}\n`)) return null;

    const closing = this.content.indexOf(`\n${DELIMITER}`, DELIMITER.length);

    if (closing === -1) return null;

    return closing + DELIMITER.length + 2;
  }
}
