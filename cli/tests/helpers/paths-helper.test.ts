import { describe, expect, it } from "vitest";

import {
  baseName,
  fileUrl,
  joinPath,
  parentDir,
  relativePath,
  resolvePath,
  splitPathTail,
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

  it("splitPathTail keeps the separator with the directory", () => {
    expect(splitPathTail("src/services/guide.md")).toEqual({
      dir: "src/services/",
      name: "guide.md",
    });
  });

  it("splitPathTail gives a bare filename an empty directory", () => {
    expect(splitPathTail("guide.md")).toEqual({ dir: "", name: "guide.md" });
  });

  it("splitPathTail treats a directory path's last segment as the name", () => {
    expect(splitPathTail("src/features/loyalty")).toEqual({
      dir: "src/features/",
      name: "loyalty",
    });
  });

  it("splitPathTail reproduces the original text exactly when rejoined", () => {
    const parts = splitPathTail("/a/b/guide.md");

    expect(parts.dir + parts.name).toBe("/a/b/guide.md");
  });

  it("fileUrl produces a file:// URL usable by dynamic import()", () => {
    expect(fileUrl("/a/b/mod.js")).toBe("file:///a/b/mod.js");
  });
});
