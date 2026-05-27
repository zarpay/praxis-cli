import { describe, expect, it } from "vitest";

import { hasGlobChars, isSpecFile } from "@/validator/spec-pattern.js";

describe("hasGlobChars", () => {
  it("returns false for plain filenames", () => {
    expect(hasGlobChars("README.md")).toBe(false);
    expect(hasGlobChars("SPEC.md")).toBe(false);
  });

  it("returns true for patterns with *", () => {
    expect(hasGlobChars("*.validate.md")).toBe(true);
    expect(hasGlobChars("README.*.md")).toBe(true);
  });

  it("returns true for patterns with ?", () => {
    expect(hasGlobChars("README?.md")).toBe(true);
  });

  it("returns true for patterns with brackets", () => {
    expect(hasGlobChars("README.[a-z].md")).toBe(true);
  });

  it("returns true for patterns with braces", () => {
    expect(hasGlobChars("{README,SPEC}.md")).toBe(true);
  });
});

describe("isSpecFile", () => {
  it("matches exact filename", () => {
    expect(isSpecFile("README.md", "README.md")).toBe(true);
    expect(isSpecFile("SPEC.md", "SPEC.md")).toBe(true);
  });

  it("rejects non-matching exact filename", () => {
    expect(isSpecFile("SPEC.md", "README.md")).toBe(false);
    expect(isSpecFile("role.md", "README.md")).toBe(false);
  });

  it("extracts basename from full path for exact match", () => {
    expect(isSpecFile("/some/dir/README.md", "README.md")).toBe(true);
    expect(isSpecFile("/some/dir/role.md", "README.md")).toBe(false);
  });

  it("matches glob pattern with leading wildcard", () => {
    expect(isSpecFile("roles.validate.md", "*.validate.md")).toBe(true);
    expect(isSpecFile("test.validate.md", "*.validate.md")).toBe(true);
    expect(isSpecFile("roles.md", "*.validate.md")).toBe(false);
  });

  it("matches glob pattern with middle wildcard", () => {
    expect(isSpecFile("README.roles.md", "README.*.md")).toBe(true);
    expect(isSpecFile("README.context.md", "README.*.md")).toBe(true);
    expect(isSpecFile("README.md", "README.*.md")).toBe(false);
  });

  it("extracts basename from full path for glob match", () => {
    expect(isSpecFile("/project/roles/README.roles.md", "README.*.md")).toBe(true);
    expect(isSpecFile("/project/roles/some-role.md", "README.*.md")).toBe(false);
  });

  it("matches brace pattern", () => {
    expect(isSpecFile("README.md", "{README,SPEC}.md")).toBe(true);
    expect(isSpecFile("SPEC.md", "{README,SPEC}.md")).toBe(true);
    expect(isSpecFile("OTHER.md", "{README,SPEC}.md")).toBe(false);
  });
});
