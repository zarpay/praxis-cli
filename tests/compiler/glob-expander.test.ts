import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { GlobExpander } from "@/compiler/glob-expander.js";

const FIXTURES_DIR = join(import.meta.dirname, "..", "fixtures");

describe("GlobExpander", () => {
  const expander = new GlobExpander(FIXTURES_DIR);

  describe("expand()", () => {
    describe("when pattern is not a glob", () => {
      it("returns the path unchanged", async () => {
        const result = await expander.expand("content/context/conventions/documentation.md");

        expect(result).toEqual(["content/context/conventions/documentation.md"]);
      });
    });

    describe("with * wildcard pattern", () => {
      it("expands to matching files", async () => {
        const result = await expander.expand("content/context/constitution/*.md");

        expect(result).toContain("content/context/constitution/identity.md");
        expect(result).toContain("content/context/constitution/principles.md");
      });

      it("excludes _template.md files", async () => {
        const result = await expander.expand("content/context/constitution/*.md");

        expect(result).not.toContain("content/context/constitution/_template.md");
      });

      it("excludes README.md files", async () => {
        const result = await expander.expand("content/context/constitution/*.md");

        expect(result).not.toContain("content/context/constitution/README.md");
      });
    });

    describe("with ** recursive pattern", () => {
      it("expands recursively", async () => {
        const result = await expander.expand("content/context/**/*.md");

        expect(result).toContain("content/context/constitution/identity.md");
        expect(result).toContain("content/context/conventions/documentation.md");
      });

      it("excludes _template.md and README.md recursively", async () => {
        const result = await expander.expand("content/context/**/*.md");

        expect(result).not.toContain("content/context/constitution/_template.md");
        expect(result).not.toContain("content/context/constitution/README.md");
      });
    });

    describe("when pattern matches no files", () => {
      it("returns empty array", async () => {
        const result = await expander.expand("nonexistent/**/*.md");

        expect(result).toEqual([]);
      });
    });
  });

  describe("expandAll()", () => {
    it("expands multiple patterns and flattens results", async () => {
      const patterns = ["content/context/constitution/*.md", "content/context/conventions/*.md"];
      const result = await expander.expandAll(patterns);

      expect(result).toContain("content/context/constitution/identity.md");
      expect(result).toContain("content/context/conventions/documentation.md");
    });

    it("handles mix of glob and non-glob patterns", async () => {
      const patterns = [
        "content/context/constitution/*.md",
        "content/context/conventions/documentation.md",
      ];
      const result = await expander.expandAll(patterns);

      expect(result).toContain("content/context/constitution/identity.md");
      expect(result).toContain("content/context/conventions/documentation.md");
    });

    it("handles empty array", async () => {
      expect(await expander.expandAll([])).toEqual([]);
    });
  });
});
