import { describe, expect, it } from "vitest";

import {
  baseName,
  fileUrl,
  joinPath,
  parentDir,
  relativePath,
  resolvePath,
} from "@/helpers/paths-helper.js";

describe("paths-helper", () => {
  it("joinPath joins segments", () => {
    expect(joinPath("/a", "b", "c.md")).toBe("/a/b/c.md");
  });

  it("resolvePath yields an absolute path", () => {
    expect(resolvePath("/a", "b")).toBe("/a/b");
  });

  it("relativePath relates one location to another", () => {
    expect(relativePath("/project", "/project/docs/guide.md")).toBe("docs/guide.md");
  });

  it("baseName takes the last segment, optionally stripping an extension", () => {
    expect(baseName("/a/b/guide.md")).toBe("guide.md");
    expect(baseName("/a/b/guide.md", ".md")).toBe("guide");
  });

  it("parentDir takes the containing directory", () => {
    expect(parentDir("/a/b/guide.md")).toBe("/a/b");
  });

  it("fileUrl produces a file:// URL usable by dynamic import()", () => {
    expect(fileUrl("/a/b/mod.js")).toBe("file:///a/b/mod.js");
  });
});
