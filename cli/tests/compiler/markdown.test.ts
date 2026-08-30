import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { Markdown } from "@/compiler/markdown.js";

const FIXTURES_DIR = join(import.meta.dirname, "..", "fixtures");

describe("Markdown", () => {
  describe("body()", () => {
    it("extracts content after frontmatter", () => {
      const md = new Markdown(join(FIXTURES_DIR, "sample-expert.md"));
      const body = md.body();

      expect(body).toContain("# Sample Role");
      expect(body).toContain("This is the sample role body content.");
    });

    it("does not include frontmatter content", () => {
      const md = new Markdown(join(FIXTURES_DIR, "sample-expert.md"));
      const body = md.body();

      expect(body).not.toContain("title: Sample Expert");
      expect(body).not.toContain("alias: Sample");
    });

    it("handles files without frontmatter", () => {
      const md = new Markdown(join(FIXTURES_DIR, "no-frontmatter.md"));
      const body = md.body();

      expect(body).toContain("# Document Without Frontmatter");
      expect(body).toContain("Just plain markdown content.");
    });

    it("trims leading/trailing whitespace", () => {
      const md = new Markdown(join(FIXTURES_DIR, "sample-expert.md"));
      const body = md.body();

      expect(body.startsWith("\n")).toBe(false);
      expect(body.endsWith("\n\n")).toBe(false);
    });
  });

  describe("bodyRaw()", () => {
    it("preserves original whitespace", () => {
      const md = new Markdown(join(FIXTURES_DIR, "sample-expert.md"));
      const raw = md.bodyRaw();

      expect(raw.startsWith("\n")).toBe(true);
    });
  });
});
