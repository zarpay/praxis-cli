import { describe, expect, it } from "vitest";

import { kebabToTitleCase } from "@/helpers/text-helper.js";

describe("kebabToTitleCase", () => {
  it("converts a kebab-case name to Title Case", () => {
    expect(kebabToTitleCase("code-reviewer")).toBe("Code Reviewer");
  });

  it("handles a single word", () => {
    expect(kebabToTitleCase("taster")).toBe("Taster");
  });

  it("handles many segments", () => {
    expect(kebabToTitleCase("enforce-code-style-guide")).toBe("Enforce Code Style Guide");
  });
});
