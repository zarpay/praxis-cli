import yaml from "js-yaml";

import { errors } from "@/core/errors.js";

/**
 * A document's frontmatter: the parsed YAML, read through accessors
 * that validate.
 *
 * Built by {@link MarkdownFile}, which owns the delimiter format and
 * hands this the YAML between the fences plus the name to use when a
 * value is wrong. This class never sees a path or the filesystem — it
 * is the metadata, not the document.
 *
 * **Every accessor raises on a wrong-shaped value** rather than casting
 * it and letting the garbage surface later: `agent_tools: [Read, Glob]`
 * fails at the file that declared it, not while writing a broken agent
 * profile. Models call these once each in their constructor, so a model
 * that exists is a valid document and no consumer re-checks.
 *
 * Absence and invalidity are different. An omitted optional key yields
 * `undefined` (or `[]` for a list); a key that is present but malformed
 * always raises.
 */
export class Frontmatter {
  private readonly rawYaml: string;
  /** How the document is named when a value is wrong. */
  private readonly docName: string;
  private cached: Record<string, unknown> | null = null;

  private constructor(rawYaml: string, docName: string) {
    this.rawYaml = rawYaml;
    this.docName = docName;
  }

  /** Wraps the YAML found between a document's fences. */
  static fromYaml(rawYaml: string, docName: string): Frontmatter {
    return new Frontmatter(rawYaml, docName);
  }

  /**
   * The frontmatter as a key-value record.
   *
   * Empty when the document declares none. Parsed once and cached, and
   * unvalidated — the accessors below are how a model should read it.
   */
  parse(): Record<string, unknown> {
    this.cached ??= this.load();
    return this.cached;
  }

  /**
   * A string the document's kind requires.
   *
   * @throws PraxisError when the key is absent, or holds a non-string
   */
  requiredString(key: string): string {
    const raw = this.parse()[key];

    if (raw === undefined || raw === null) {
      throw errors.missingFrontmatterField(key, this.docName);
    }

    return this.asString(key, raw);
  }

  /**
   * A string the document's kind allows but does not require.
   *
   * @throws PraxisError when the key is present but holds a non-string
   */
  optionalString(key: string): string | undefined {
    const raw = this.parse()[key];

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
    const raw = this.parse()[key];

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
    const raw = this.parse()[key];

    if (raw === undefined || raw === null) return undefined;

    if (typeof raw === "string" && (allowed as readonly string[]).includes(raw)) {
      return raw as T;
    }

    throw errors.invalidFrontmatterField(
      key,
      this.docName,
      allowed.map((value) => `"${value}"`).join(" or "),
      raw,
    );
  }

  /** Narrows one value to a string, naming the key when it isn't one. */
  private asString(key: string, raw: unknown): string {
    if (typeof raw !== "string") {
      throw errors.invalidFrontmatterField(key, this.docName, "a string", raw);
    }

    return raw;
  }

  /**
   * Parses the YAML with js-yaml's safe load.
   *
   * Permits Date objects in the schema to match Ruby's YAML.safe_load
   * behavior.
   */
  private load(): Record<string, unknown> {
    if (!this.rawYaml) {
      return {};
    }

    const parsed = yaml.load(this.rawYaml, { schema: yaml.DEFAULT_SCHEMA });

    return (parsed as Record<string, unknown>) ?? {};
  }
}
