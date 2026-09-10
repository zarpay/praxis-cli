import { join } from "node:path";
import { describe, expect, it } from "vitest";

import expandGlobsService from "@/services/expand-globs-service.js";
import { testConfig } from "@tests/helpers/test-config.js";

const FIXTURES_DIR = join(import.meta.dirname, "..", "fixtures");

describe("expandGlobsService", () => {
  /** Expands one pattern against the fixture tree, returning its matches. */
  async function matches(pattern: string): Promise<string[]> {
    const [expansion] = await expandGlobsService(testConfig(FIXTURES_DIR), { patterns: [pattern] });
    return expansion.matches;
  }

  describe("one pattern", () => {
    describe("when pattern is not a glob", () => {
      it("returns the path unchanged", async () => {
        const result = await matches("content/context/conventions/documentation.md");

        expect(result).toEqual(["content/context/conventions/documentation.md"]);
      });
    });

    describe("with * wildcard pattern", () => {
      it("expands to matching files", async () => {
        const result = await matches("content/context/constitution/*.md");

        expect(result).toContain("content/context/constitution/identity.md");
        expect(result).toContain("content/context/constitution/principles.md");
      });

      it("excludes _template.md files", async () => {
        const result = await matches("content/context/constitution/*.md");

        expect(result).not.toContain("content/context/constitution/_template.md");
      });

      it("excludes README.md files", async () => {
        const result = await matches("content/context/constitution/*.md");

        expect(result).not.toContain("content/context/constitution/README.md");
      });
    });

    describe("with ** recursive pattern", () => {
      it("expands recursively", async () => {
        const result = await matches("content/context/**/*.md");

        expect(result).toContain("content/context/constitution/identity.md");
        expect(result).toContain("content/context/conventions/documentation.md");
      });

      it("excludes _template.md and README.md recursively", async () => {
        const result = await matches("content/context/**/*.md");

        expect(result).not.toContain("content/context/constitution/_template.md");
        expect(result).not.toContain("content/context/constitution/README.md");
      });
    });

    describe("when pattern matches no files", () => {
      it("returns empty array", async () => {
        const result = await matches("nonexistent/**/*.md");

        expect(result).toEqual([]);
      });
    });
  });

  describe("several patterns", () => {
    it("expands multiple patterns and flattens results", async () => {
      const patterns = ["content/context/constitution/*.md", "content/context/conventions/*.md"];
      const expansions = await expandGlobsService(testConfig(FIXTURES_DIR), { patterns });
      const result = expansions.flatMap((e) => e.matches);

      expect(result).toContain("content/context/constitution/identity.md");
      expect(result).toContain("content/context/conventions/documentation.md");
    });

    it("handles mix of glob and non-glob patterns", async () => {
      const patterns = [
        "content/context/constitution/*.md",
        "content/context/conventions/documentation.md",
      ];
      const expansions = await expandGlobsService(testConfig(FIXTURES_DIR), { patterns });
      const result = expansions.flatMap((e) => e.matches);

      expect(result).toContain("content/context/constitution/identity.md");
      expect(result).toContain("content/context/conventions/documentation.md");
    });

    it("handles empty array", async () => {
      const expansions = await expandGlobsService(testConfig(FIXTURES_DIR), { patterns: [] });

      expect(expansions).toEqual([]);
    });
  });

  describe("the isGlob flag", () => {
    it("marks a wildcard pattern as a glob", async () => {
      const [expansion] = await expandGlobsService(testConfig(FIXTURES_DIR), {
        patterns: ["content/context/**/*.md"],
      });

      expect(expansion.isGlob).toBe(true);
    });

    it("marks a plain path as not a glob, matching only itself", async () => {
      const [expansion] = await expandGlobsService(testConfig(FIXTURES_DIR), {
        patterns: ["content/context/conventions/documentation.md"],
      });

      expect(expansion.isGlob).toBe(false);
      expect(expansion.matches).toEqual(["content/context/conventions/documentation.md"]);
    });
  });
});
