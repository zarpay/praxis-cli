import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { MarkdownFile } from "@/core/markdown-file.js";

const FIXTURES_DIR = join(import.meta.dirname, "..", "fixtures");

describe("Frontmatter", () => {
  describe("parse()", () => {
    it("extracts YAML between --- delimiters", () => {
      const fm = MarkdownFile.at(join(FIXTURES_DIR, "sample-expert.md")).frontmatter;
      const result = fm.parse();

      expect(result).toBeTypeOf("object");
      expect(result["title"]).toBe("Sample Expert");
    });

    it("returns empty object for files without frontmatter", () => {
      const fm = MarkdownFile.at(join(FIXTURES_DIR, "no-frontmatter.md")).frontmatter;

      expect(fm.parse()).toEqual({});
    });
  });

  describe("value()", () => {
    it("returns single values like alias", () => {
      const fm = MarkdownFile.at(join(FIXTURES_DIR, "sample-expert.md")).frontmatter;

      expect(fm.value("alias")).toBe("Sample");
    });

    it("returns single values like title", () => {
      const fm = MarkdownFile.at(join(FIXTURES_DIR, "sample-expert.md")).frontmatter;

      expect(fm.value("title")).toBe("Sample Expert");
    });

    it("returns undefined for missing keys", () => {
      const fm = MarkdownFile.at(join(FIXTURES_DIR, "sample-expert.md")).frontmatter;

      expect(fm.value("nonexistent")).toBeUndefined();
    });
  });

  describe("array()", () => {
    it("returns array for constitution glob patterns", () => {
      const fm = MarkdownFile.at(join(FIXTURES_DIR, "sample-expert.md")).frontmatter;

      expect(fm.parse()["constitution"]).toEqual(["content/context/constitution/*.md"]);
    });

    it("returns array values for context", () => {
      const fm = MarkdownFile.at(join(FIXTURES_DIR, "sample-expert.md")).frontmatter;

      expect(fm.array("context")).toEqual(["content/context/conventions/documentation.md"]);
    });

    it("returns array values for practices", () => {
      const fm = MarkdownFile.at(join(FIXTURES_DIR, "sample-expert.md")).frontmatter;

      expect(fm.array("practices")).toEqual(["content/practices/sample-practice.md"]);
    });

    it("returns empty array for missing keys", () => {
      const fm = MarkdownFile.at(join(FIXTURES_DIR, "sample-expert.md")).frontmatter;

      expect(fm.array("nonexistent")).toEqual([]);
    });

    it("wraps single values in an array", () => {
      const fm = MarkdownFile.at(join(FIXTURES_DIR, "sample-expert.md")).frontmatter;

      expect(fm.array("manager")).toEqual(["test@example.com"]);
    });
  });

  describe("array() typing", () => {
    it("returns string[] without a cast at the call site", () => {
      const fm = MarkdownFile.at(join(FIXTURES_DIR, "sample-expert.md")).frontmatter;
      const practices = fm.array("practices");
      const joined = practices.join(",");

      expect(joined).toBe("content/practices/sample-practice.md");
    });
  });

  describe("optionalValue()", () => {
    it("returns the value when the key is present", () => {
      const fm = MarkdownFile.at(join(FIXTURES_DIR, "sample-expert.md")).frontmatter;
      const alias = fm.optionalValue("alias");

      expect(alias).toBe("Sample");
    });

    it("returns undefined for missing keys", () => {
      const fm = MarkdownFile.at(join(FIXTURES_DIR, "sample-expert.md")).frontmatter;
      const missing = fm.optionalValue("nonexistent");

      expect(missing).toBeUndefined();
    });
  });

  describe("optionalArray()", () => {
    it("returns the values when the key is present", () => {
      const fm = MarkdownFile.at(join(FIXTURES_DIR, "sample-expert.md")).frontmatter;
      const context = fm.optionalArray("context");

      expect(context).toEqual(["content/context/conventions/documentation.md"]);
    });

    it("wraps single values in an array", () => {
      const fm = MarkdownFile.at(join(FIXTURES_DIR, "sample-expert.md")).frontmatter;
      const manager = fm.optionalArray("manager");

      expect(manager).toEqual(["test@example.com"]);
    });

    it("returns undefined for missing keys, not an empty array", () => {
      const fm = MarkdownFile.at(join(FIXTURES_DIR, "sample-expert.md")).frontmatter;
      const missing = fm.optionalArray("nonexistent");

      expect(missing).toBeUndefined();
    });

    it("returns undefined when the key holds an empty list", () => {
      const fm = MarkdownFile.fromContent(
        ["---", "excludes: []", "---", "# Body"].join("\n"),
      ).frontmatter;
      const excludes = fm.optionalArray("excludes");

      expect(excludes).toBeUndefined();
    });
  });
});
