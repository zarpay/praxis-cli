import { describe, expect, it } from "vitest";

import isTarget from "@/domains/eval/services/is-target.js";

describe("isTarget", () => {
  it("accepts an ordinary target file", () => {
    expect(isTarget("/p/src/awards.ts", "README.md")).toBe(true);
  });

  it("rejects the spec itself — direction is never a target of itself", () => {
    expect(isTarget("/p/src/README.md", "README.md")).toBe(false);
  });

  it("rejects a spec matched by a glob pattern", () => {
    expect(isTarget("/p/docs/services.sme.md", "*.sme.md")).toBe(false);
  });

  it("rejects an underscore-prefixed file as a template", () => {
    expect(isTarget("/p/src/_template.md", "README.md")).toBe(false);
  });

  it("judges a file whose directory is underscore-prefixed", () => {
    // The rule is about the filename, not the path it sits under.
    expect(isTarget("/p/_scratch/real.ts", "README.md")).toBe(true);
  });

  it("does not confuse a spec-like name elsewhere in the path", () => {
    expect(isTarget("/p/README.md/actual.ts", "README.md")).toBe(true);
  });
});
