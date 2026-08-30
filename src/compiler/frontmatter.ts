import { readFileSync } from "node:fs";

import yaml from "js-yaml";

/** Delimiter used to fence YAML frontmatter in markdown files. */
const DELIMITER = "---";

/**
 * Parses YAML frontmatter from a markdown file.
 *
 * Extracts the YAML block between the opening and closing `---` delimiters
 * at the top of a file. Provides typed accessors for single values and
 * array values, with graceful handling of missing keys or absent frontmatter.
 */
export class Frontmatter {
  private readonly content: string;
  private cached: Record<string, unknown> | null = null;

  private constructor(content: string) {
    this.content = content;
  }

  /** Creates a Frontmatter parser by reading the given file. */
  static fromFile(filePath: string): Frontmatter {
    return new Frontmatter(readFileSync(filePath, "utf-8"));
  }

  /**
   * Creates a Frontmatter parser from already-loaded file content.
   *
   * Useful when the caller has read the file for other purposes and
   * should not pay for (or depend on) a second filesystem read.
   */
  static fromContent(content: string): Frontmatter {
    return new Frontmatter(content);
  }

  /**
   * Parses and returns the frontmatter as a key-value record.
   *
   * Returns an empty object if the file has no frontmatter.
   * Results are cached after the first call.
   */
  parse(): Record<string, unknown> {
    this.cached ??= this.extractAndParse();
    return this.cached;
  }

  /**
   * Returns a single frontmatter value by key.
   *
   * @param key - The frontmatter field name
   * @returns The value, or undefined if the key does not exist
   */
  value(key: string): unknown {
    return this.parse()[key];
  }

  /**
   * Returns a frontmatter value as an array.
   *
   * If the value is already an array, returns it as-is.
   * If it's a single value, wraps it in an array.
   * If the key is missing, returns an empty array.
   *
   * @param key - The frontmatter field name
   */
  array(key: string): unknown[] {
    const val = this.parse()[key];
    if (val === undefined || val === null) {
      return [];
    }
    if (Array.isArray(val)) {
      return val;
    }
    return [val];
  }

  /**
   * Returns the raw YAML string between delimiters, without parsing.
   *
   * Useful for debugging or re-serialization. Returns an empty string
   * if the file has no frontmatter.
   */
  rawYaml(): string {
    return this.extractRawYaml();
  }

  /**
   * Extracts the YAML string and parses it with js-yaml safe load.
   *
   * Permits Date objects in the YAML schema to match Ruby's YAML.safe_load behavior.
   */
  private extractAndParse(): Record<string, unknown> {
    const yamlStr = this.extractRawYaml();
    if (!yamlStr) {
      return {};
    }
    const parsed = yaml.load(yamlStr, { schema: yaml.DEFAULT_SCHEMA });
    return (parsed as Record<string, unknown>) ?? {};
  }

  /**
   * Finds and returns the raw YAML content between the opening
   * and closing `---` delimiters.
   */
  private extractRawYaml(): string {
    if (!this.content.startsWith(`${DELIMITER}\n`)) {
      return "";
    }

    const endIndex = this.content.indexOf(`\n${DELIMITER}`, DELIMITER.length);
    if (endIndex === -1) {
      return "";
    }

    return this.content.slice(DELIMITER.length + 1, endIndex);
  }
}
