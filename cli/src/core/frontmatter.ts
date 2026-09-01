import yaml from "js-yaml";

/**
 * A document's frontmatter: the parsed YAML, with typed accessors.
 *
 * Built by {@link MarkdownFile}, which owns the delimiter format and
 * hands this the YAML between the fences. This class never sees a path
 * or a filesystem — it is the metadata, not the document.
 *
 * The accessors come in pairs. `value`/`array` always return something
 * (undefined, or an empty list); `optionalValue`/`optionalArray` return
 * undefined for an absent key, which is what a caller writing into an
 * optional field wants — an absent key stays absent rather than
 * becoming `[]`.
 *
 * YAML is untyped, so the generics are unchecked trust, stated once
 * here instead of as a cast at every call site. Validation is
 * `core/frontmatter-fields.ts`, which raises on a wrong-shaped value.
 */
export class Frontmatter {
  private readonly rawYaml: string;
  private cached: Record<string, unknown> | null = null;

  private constructor(rawYaml: string) {
    this.rawYaml = rawYaml;
  }

  /** Wraps the YAML found between a document's fences. */
  static fromYaml(rawYaml: string): Frontmatter {
    return new Frontmatter(rawYaml);
  }

  /**
   * The frontmatter as a key-value record.
   *
   * Empty when the document declares none. Parsed once and cached.
   */
  parse(): Record<string, unknown> {
    this.cached ??= this.load();
    return this.cached;
  }

  /**
   * A single value, untyped.
   *
   * For callers that must inspect the raw shape — validating an enum,
   * or distinguishing `false` from absent. Everyone else wants
   * `optionalValue`.
   */
  value(key: string): unknown {
    return this.parse()[key];
  }

  /**
   * A single value, or undefined when the key is absent.
   *
   * @param key - The frontmatter field name
   */
  optionalValue<T = string>(key: string): T | undefined {
    return this.parse()[key] as T | undefined;
  }

  /**
   * A value as a list; an absent key is an empty list.
   *
   * A bare value is wrapped, so `context: docs/why.md` and its
   * one-element list form are the same declaration.
   *
   * @param key - The frontmatter field name
   */
  array<T = string>(key: string): T[] {
    const val = this.parse()[key];

    if (val === undefined || val === null) {
      return [];
    }

    if (Array.isArray(val)) {
      return val as T[];
    }

    return [val as T];
  }

  /**
   * A value as a list, or undefined when the key is absent or empty.
   *
   * @param key - The frontmatter field name
   */
  optionalArray<T = string>(key: string): T[] | undefined {
    const values = this.array<T>(key);

    return values.length > 0 ? values : undefined;
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
