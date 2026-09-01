import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { MarkdownFile } from "@/core/markdown-file.js";

const FIXTURES_DIR = join(import.meta.dirname, "..", "fixtures");

/** The sample document, read from disk. */
function sample(): MarkdownFile {
  return MarkdownFile.at(join(FIXTURES_DIR, "sample-expert.md"));
}

describe("MarkdownFile", () => {
  describe("body", () => {
    it("returns the prose after the frontmatter", () => {
      const body = sample().body;

      expect(body).toContain("# Sample Role");
      expect(body).toContain("This is the sample role body content.");
    });

    it("excludes the frontmatter itself", () => {
      const body = sample().body;

      expect(body).not.toContain("title: Sample Expert");
      expect(body).not.toContain("alias: Sample");
    });

    it("returns the whole file when there is no frontmatter", () => {
      const body = MarkdownFile.at(join(FIXTURES_DIR, "no-frontmatter.md")).body;

      expect(body).toContain("# Document Without Frontmatter");
    });

    it("trims surrounding whitespace", () => {
      const body = sample().body;

      expect(body).toBe(body.trim());
      expect(body.startsWith("#")).toBe(true);
    });

    it("treats an unclosed frontmatter fence as all body", () => {
      const document = MarkdownFile.fromContent("---\nalias: Nope\n\n# Body");

      expect(document.body).toContain("alias: Nope");
    });
  });

  describe("bodyRaw", () => {
    it("preserves the original whitespace", () => {
      const document = MarkdownFile.fromContent("---\nalias: A\n---\n\n\n# Title\n\n");

      expect(document.bodyRaw).toBe("\n\n# Title\n\n");
    });
  });

  describe("rawYaml", () => {
    it("returns the YAML between the fences", () => {
      const yaml = sample().rawYaml;

      expect(yaml).toContain("title: Sample Expert");
      expect(yaml).toContain("alias: Sample");
    });

    it("returns an empty string when there is no frontmatter", () => {
      const yaml = MarkdownFile.at(join(FIXTURES_DIR, "no-frontmatter.md")).rawYaml;

      expect(yaml).toBe("");
    });

    it("does not include the fences themselves", () => {
      const yaml = MarkdownFile.fromContent("---\nalias: A\n---\n# Body").rawYaml;

      expect(yaml).toBe("alias: A");
    });
  });

  describe("frontmatter", () => {
    it("exposes the parsed metadata", () => {
      const alias = sample().frontmatter.optionalString("alias");

      expect(alias).toBe("Sample");
    });

    it("is the same instance on repeat access — parsed once", () => {
      const document = sample();

      expect(document.frontmatter).toBe(document.frontmatter);
    });
  });

  describe("name", () => {
    it("defaults to the path it was read from", () => {
      const path = join(FIXTURES_DIR, "sample-expert.md");

      expect(MarkdownFile.at(path).name).toBe(path);
    });

    it("takes a caller-supplied name instead", () => {
      const document = MarkdownFile.at(join(FIXTURES_DIR, "sample-expert.md"), "experts/sample.md");

      expect(document.name).toBe("experts/sample.md");
    });

    it("names the document in the errors its frontmatter raises", () => {
      const document = MarkdownFile.fromContent("---\ntitle: X\n---\n#", "specs/api.md");
      const read = () => document.frontmatter.requiredString("alias");

      expect(read).toThrow(/specs\/api\.md/);
    });
  });
});
