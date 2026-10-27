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

    if (end === null) return "";

    // The opening fence is `---\n` or `---\r\n`; skip exactly what was
    // there so the YAML block never starts with a stray carriage return.
    const open = this.openingFence();

    if (open === null) return "";

    return this.content.slice(open.length, end - DELIMITER.length - 2);
  }

  /**
   * Index just past the closing fence, or null when there is no
   * frontmatter block to close.
   */
  private frontmatterEnd(): number | null {
    // Accept both LF and CRLF line endings. A checkout with
    // `core.autocrlf=true` (the default on Windows) rewrites every
    // tracked markdown file to CRLF, and an LF-only check would make
    // every spec, expert and practice look like it had no frontmatter
    // at all.
    const open = this.openingFence();

    if (open === null) return null;

    const closing = this.content.indexOf(`\n${DELIMITER}`, open.length);

    if (closing === -1) return null;

    return closing + DELIMITER.length + 2;
  }

  /**
   * The opening fence as it is actually written, or null when the
   * document has no frontmatter block.
   *
   * Both `---\n` and `---\r\n` are accepted; the exact bytes are
   * returned so the caller can skip precisely what was there.
   */
  private openingFence(): string | null {
    if (this.content.startsWith(`${DELIMITER}\r\n`)) return `${DELIMITER}\r\n`;

    if (this.content.startsWith(`${DELIMITER}\n`)) return `${DELIMITER}\n`;

    return null;
  }
}
