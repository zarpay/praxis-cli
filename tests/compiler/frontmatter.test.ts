import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { Frontmatter } from "@/compiler/frontmatter.js";

const FIXTURES_DIR = join(import.meta.dirname, "..", "fixtures");

describe("Frontmatter", () => {
  describe("parse()", () => {
    it("extracts YAML between --- delimiters", () => {
      const fm = Frontmatter.fromFile(join(FIXTURES_DIR, "sample-role.md"));
      const result = fm.parse();

      expect(result).toBeTypeOf("object");
      expect(result["title"]).toBe("Sample Role");
    });

    it("returns empty object for files without frontmatter", () => {
      const fm = Frontmatter.fromFile(join(FIXTURES_DIR, "no-frontmatter.md"));

      expect(fm.parse()).toEqual({});
    });
  });

  describe("value()", () => {
    it("returns single values like alias", () => {
      const fm = Frontmatter.fromFile(join(FIXTURES_DIR, "sample-role.md"));

      expect(fm.value("alias")).toBe("Sample");
    });

    it("returns single values like title", () => {
      const fm = Frontmatter.fromFile(join(FIXTURES_DIR, "sample-role.md"));

      expect(fm.value("title")).toBe("Sample Role");
    });

    it("returns undefined for missing keys", () => {
      const fm = Frontmatter.fromFile(join(FIXTURES_DIR, "sample-role.md"));

      expect(fm.value("nonexistent")).toBeUndefined();
    });
  });

  describe("array()", () => {
    it("returns array for constitution glob patterns", () => {
      const fm = Frontmatter.fromFile(join(FIXTURES_DIR, "sample-role.md"));

      expect(fm.parse()["constitution"]).toEqual(["content/context/constitution/*.md"]);
    });

    it("returns array values for context", () => {
      const fm = Frontmatter.fromFile(join(FIXTURES_DIR, "sample-role.md"));

      expect(fm.array("context")).toEqual(["content/context/conventions/documentation.md"]);
    });

    it("returns array values for responsibilities", () => {
      const fm = Frontmatter.fromFile(join(FIXTURES_DIR, "sample-role.md"));

      expect(fm.array("responsibilities")).toEqual([
        "content/responsibilities/sample-responsibility.md",
      ]);
    });

    it("returns empty array for missing keys", () => {
      const fm = Frontmatter.fromFile(join(FIXTURES_DIR, "sample-role.md"));

      expect(fm.array("nonexistent")).toEqual([]);
    });

    it("wraps single values in an array", () => {
      const fm = Frontmatter.fromFile(join(FIXTURES_DIR, "sample-role.md"));

      expect(fm.array("manager")).toEqual(["test@example.com"]);
    });
  });

  describe("rawYaml()", () => {
    it("returns the raw YAML string between delimiters", () => {
      const fm = Frontmatter.fromFile(join(FIXTURES_DIR, "sample-role.md"));
      const yaml = fm.rawYaml();

      expect(yaml).toContain("title: Sample Role");
      expect(yaml).toContain("alias: Sample");
    });

    it("returns empty string for files without frontmatter", () => {
      const fm = Frontmatter.fromFile(join(FIXTURES_DIR, "no-frontmatter.md"));

      expect(fm.rawYaml()).toBe("");
    });
  });
});
