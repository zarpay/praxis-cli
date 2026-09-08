import { describe, expect, it } from "vitest";

import { SpecFile } from "@/models/spec-file.js";

/** Builds a spec from frontmatter lines, without touching the filesystem. */
function spec(lines: string[], path = "/project/src/services/README.md", root?: string): SpecFile {
  const content = ["---", ...lines, "---", "", "# Spec body"].join("\n");
  return SpecFile.fromContent(content, path, root);
}

describe("SpecFile", () => {
  describe("structural validation", () => {
    it("raises when a list holds a non-string entry", () => {
      const build = () => spec(["paths:", "  - 42"]);

      expect(build).toThrow(/Invalid "paths".*expected a string, got 42/s);
    });
  });

  describe("paths", () => {
    it("returns the declared target patterns", () => {
      const patterns = spec(["paths:", '  - "src/services/*.ts"']).paths;

      expect(patterns).toEqual(["src/services/*.ts"]);
    });

    it("returns an empty array when undeclared", () => {
      const patterns = spec(["cohort: by_file"]).paths;

      expect(patterns).toEqual([]);
    });
  });

  describe("cohort", () => {
    it("defaults to by_file when undeclared", () => {
      const cohort = spec(["paths:", '  - "src/*.ts"']).cohort;

      expect(cohort).toBe("by_file");
    });

    it("returns a declared by_directory", () => {
      const cohort = spec(["cohort: by_directory"]).cohort;

      expect(cohort).toBe("by_directory");
    });

    it("raises at construction on a value outside the enum", () => {
      const build = () => spec(["cohort: by_module"]);

      expect(build).toThrow(/expected "by_file" or "by_directory", got "by_module"/);
    });

    it("raises on a non-string value, showing it as JSON", () => {
      const build = () => spec(["cohort:", "  - by_file"]);

      expect(build).toThrow(/\["by_file"\]/);
    });

    it("names the spec relative to the root when one is given", () => {
      const build = () => spec(["cohort: nope"], "/project/src/services/README.md", "/project");

      expect(build).toThrow(/src\/services\/README\.md/);
    });
  });

  describe("excludes", () => {
    it("returns patterns as written, unresolved — the retired exemplars key is ignored", () => {
      const subject = spec([
        "excludes:",
        '  - "src/services/legacy.ts"',
        "exemplars:",
        '  - "src/services/good.ts"',
      ]);

      expect(subject.excludes).toEqual(["src/services/legacy.ts"]);
    });

    it("returns empty arrays when undeclared", () => {
      const subject = spec(["paths:", '  - "src/*.ts"']);

      expect(subject.excludes).toEqual([]);
    });
  });

  describe("contextPatterns()", () => {
    it("reads the context key", () => {
      const patterns = spec(["context:", '  - "docs/why.md"']).contextPatterns();

      expect(patterns).toEqual(["docs/why.md"]);
    });

    it("wraps a single value in an array", () => {
      const patterns = spec(["context: docs/why.md"]).contextPatterns();

      expect(patterns).toEqual(["docs/why.md"]);
    });
  });

  it("keeps the path it was built with", () => {
    const subject = spec(["paths:", '  - "src/*.ts"'], "/project/tests/README.md");

    expect(subject.path).toBe("/project/tests/README.md");
  });
});
