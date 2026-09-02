import type { Frontmatter } from "@/models/frontmatter.js";

import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { MarkdownFile } from "@/models/markdown-file.js";

const FIXTURES_DIR = join(import.meta.dirname, "..", "fixtures");

/** The sample document's frontmatter. */
function sample(): Frontmatter {
  return MarkdownFile.at(join(FIXTURES_DIR, "sample-expert.md")).frontmatter;
}

/** Frontmatter from YAML lines, named for error messages. */
function frontmatter(lines: string[], name = "doc.md"): Frontmatter {
  return MarkdownFile.fromContent(["---", ...lines, "---", "# Body"].join("\n"), name).frontmatter;
}

describe("Frontmatter", () => {
  describe("parse()", () => {
    it("returns the declared keys", () => {
      const parsed = sample().parse();

      expect(parsed["title"]).toBe("Sample Expert");
    });

    it("returns an empty object for a document with no frontmatter", () => {
      const parsed = MarkdownFile.at(join(FIXTURES_DIR, "no-frontmatter.md")).frontmatter.parse();

      expect(parsed).toEqual({});
    });
  });

  describe("requiredString()", () => {
    it("returns the value when present", () => {
      expect(sample().requiredString("alias")).toBe("Sample");
    });

    it("raises when the key is absent, naming the document", () => {
      const read = () => frontmatter(["title: X"], "experts/broken.md").requiredString("alias");

      expect(read).toThrow(/experts\/broken\.md is missing required frontmatter field "alias"/);
    });

    it("raises when the value is not a string", () => {
      const read = () => frontmatter(["alias:", "  - A"]).requiredString("alias");

      expect(read).toThrow(/expected a string, got \["A"\]/);
    });
  });

  describe("optionalString()", () => {
    it("returns the value when present", () => {
      expect(sample().optionalString("title")).toBe("Sample Expert");
    });

    it("returns undefined for an absent key", () => {
      expect(sample().optionalString("nonexistent")).toBeUndefined();
    });

    it("raises when the key is present but malformed", () => {
      const read = () => frontmatter(["owner:", "  - A"]).optionalString("owner");

      expect(read).toThrow(/Invalid "owner"/);
    });
  });

  describe("stringList()", () => {
    it("returns a declared list", () => {
      expect(sample().stringList("context")).toEqual([
        "content/context/conventions/documentation.md",
      ]);
    });

    it("wraps a bare value, so both spellings are one declaration", () => {
      expect(sample().stringList("manager")).toEqual(["test@example.com"]);
    });

    it("returns an empty list for an absent key", () => {
      expect(sample().stringList("nonexistent")).toEqual([]);
    });

    it("returns an empty list for an empty list", () => {
      expect(frontmatter(["excludes: []"]).stringList("excludes")).toEqual([]);
    });

    it("raises when an entry is not a string", () => {
      const read = () => frontmatter(["paths:", "  - 42"]).stringList("paths");

      expect(read).toThrow(/Invalid "paths".*expected a string, got 42/s);
    });
  });

  describe("requiredInt()", () => {
    it("returns a declared whole number", () => {
      const version = frontmatter(["version: 2"]).requiredInt("version");

      expect(version).toBe(2);
    });

    it("throws when the key is absent", () => {
      const readMissing = () => frontmatter([]).requiredInt("version");

      expect(readMissing).toThrow(/version/);
    });

    it("throws on a non-integer value", () => {
      const readFraction = () => frontmatter(["version: 1.5"]).requiredInt("version");

      expect(readFraction).toThrow(/whole number/);
    });

    it("throws on a string that looks numeric", () => {
      const readString = () => frontmatter(['version: "2"']).requiredInt("version");

      expect(readString).toThrow(/whole number/);
    });
  });

  describe("requiredDate()", () => {
    it("returns a bare YAML date as YYYY-MM-DD", () => {
      const introduced = frontmatter(["introduced: 2026-08-29"]).requiredDate("introduced");

      expect(introduced).toBe("2026-08-29");
    });

    it("accepts the same shape quoted as a string", () => {
      const introduced = frontmatter(['introduced: "2026-08-29"']).requiredDate("introduced");

      expect(introduced).toBe("2026-08-29");
    });

    it("throws when the key is absent", () => {
      const readMissing = () => frontmatter([]).requiredDate("introduced");

      expect(readMissing).toThrow(/introduced/);
    });

    it("throws on a value in neither form", () => {
      const readWords = () => frontmatter(["introduced: yesterday"]).requiredDate("introduced");

      expect(readWords).toThrow(/a date like/);
    });
  });

  describe("enumValue()", () => {
    const MODES = ["by_file", "by_directory"] as const;

    it("returns a value inside the set", () => {
      expect(frontmatter(["cohort: by_directory"]).enumValue("cohort", MODES)).toBe("by_directory");
    });

    it("returns undefined for an absent key", () => {
      expect(frontmatter(["paths: src/*"]).enumValue("cohort", MODES)).toBeUndefined();
    });

    it("raises outside the set, listing what is accepted", () => {
      const read = () => frontmatter(["cohort: by_magic"]).enumValue("cohort", MODES);

      expect(read).toThrow(/expected "by_file" or "by_directory", got "by_magic"/);
    });

    it("shows a non-string value as JSON", () => {
      const read = () => frontmatter(["cohort:", "  - by_file"]).enumValue("cohort", MODES);

      expect(read).toThrow(/\["by_file"\]/);
    });
  });
});
