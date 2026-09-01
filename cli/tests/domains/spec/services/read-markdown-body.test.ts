import { join } from "node:path";
import { describe, expect, it } from "vitest";

import readMarkdownBody from "@/domains/spec/services/read-markdown-body.js";

const FIXTURES_DIR = join(import.meta.dirname, "..", "..", "..", "fixtures");

describe("readMarkdownBody", () => {
  it("returns the content after the frontmatter", () => {
    const body = readMarkdownBody(join(FIXTURES_DIR, "sample-expert.md"));

    expect(body).toContain("# Sample Role");
    expect(body).toContain("This is the sample role body content.");
  });

  it("excludes the frontmatter itself", () => {
    const body = readMarkdownBody(join(FIXTURES_DIR, "sample-expert.md"));

    expect(body).not.toContain("title: Sample Expert");
    expect(body).not.toContain("alias: Sample");
  });

  it("returns the whole file when there is no frontmatter", () => {
    const body = readMarkdownBody(join(FIXTURES_DIR, "no-frontmatter.md"));

    expect(body).toContain("# Document Without Frontmatter");
  });

  it("trims leading and trailing whitespace", () => {
    const body = readMarkdownBody(join(FIXTURES_DIR, "sample-expert.md"));

    expect(body).toBe(body.trim());
    expect(body.startsWith("#")).toBe(true);
  });
});
