import { errors } from "@/core/errors.js";
import { Frontmatter } from "@/core/frontmatter.js";

/**
 * Validated frontmatter reads, shared by every document model.
 *
 * Models call these once each, in their constructor, so a document is
 * either fully valid or never exists. Every reader raises on a
 * wrong-shaped value rather than casting it and letting the garbage
 * surface later — `agent_tools: [Read, Glob]` fails here, at the file
 * that declared it, instead of writing a broken agent profile.
 *
 * Absence and invalidity are different: an omitted optional key yields
 * `undefined` (or `[]` for a list), while a key that is present but
 * malformed always raises.
 */
export class Fields {
  private readonly fm: Frontmatter;
  /** How this document is named in error messages. */
  private readonly docPath: string;

  constructor(fm: Frontmatter, docPath: string) {
    this.fm = fm;
    this.docPath = docPath;
  }

  /** Reads a document from disk. */
  static fromFile(path: string, docPath: string): Fields {
    return new Fields(Frontmatter.fromFile(path), docPath);
  }

  /** Reads a document from already-loaded content. */
  static fromContent(content: string, docPath: string): Fields {
    return new Fields(Frontmatter.fromContent(content), docPath);
  }

  /**
   * A string the document's kind requires.
   *
   * @throws PraxisError when the key is absent, or holds a non-string
   */
  requiredString(key: string): string {
    const raw = this.fm.value(key);

    if (raw === undefined || raw === null) {
      throw errors.missingFrontmatterField(key, this.docPath);
    }

    return this.asString(key, raw);
  }

  /**
   * A string the document's kind allows but does not require.
   *
   * @throws PraxisError when the key is present but holds a non-string
   */
  optionalString(key: string): string | undefined {
    const raw = this.fm.value(key);

    if (raw === undefined || raw === null) return undefined;

    return this.asString(key, raw);
  }

  /**
   * A list of strings; an absent key is an empty list.
   *
   * A bare value is wrapped, so `context: docs/why.md` and its
   * one-element list form are the same declaration.
   *
   * @throws PraxisError when any entry is not a string
   */
  stringList(key: string): string[] {
    const raw = this.fm.value(key);

    if (raw === undefined || raw === null) return [];

    const values = Array.isArray(raw) ? raw : [raw];

    return values.map((entry) => this.asString(key, entry));
  }

  /**
   * A string from a fixed set; an absent key yields undefined.
   *
   * @throws PraxisError when the key holds anything outside the set
   */
  enumValue<T extends string>(key: string, allowed: readonly T[]): T | undefined {
    const raw = this.fm.value(key);

    if (raw === undefined || raw === null) return undefined;

    if (typeof raw === "string" && (allowed as readonly string[]).includes(raw)) {
      return raw as T;
    }

    throw errors.invalidFrontmatterField(
      key,
      this.docPath,
      allowed.map((value) => `"${value}"`).join(" or "),
      raw,
    );
  }

  /** Narrows one value to a string, naming the key when it isn't one. */
  private asString(key: string, raw: unknown): string {
    if (typeof raw !== "string") {
      throw errors.invalidFrontmatterField(key, this.docPath, "a string", raw);
    }

    return raw;
  }
}
