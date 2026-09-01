import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  copyFile,
  ensureDir,
  exists,
  hasGlobChars,
  matchesFilename,
  readJson,
  readText,
  removeFile,
  writeJson,
  writeText,
} from "@/core/files.js";

describe("files", () => {
  let dir: string;

  beforeEach(() => {
    dir = join(tmpdir(), `praxis-files-test-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  describe("exists()", () => {
    it("returns true for files and directories, false otherwise", () => {
      writeFileSync(join(dir, "file.txt"), "x");

      expect(exists(join(dir, "file.txt"))).toBe(true);
      expect(exists(dir)).toBe(true);
      expect(exists(join(dir, "missing.txt"))).toBe(false);
    });
  });

  describe("readText()", () => {
    it("reads UTF-8 content", () => {
      writeFileSync(join(dir, "file.txt"), "héllo\n");

      expect(readText(join(dir, "file.txt"))).toBe("héllo\n");
    });

    it("throws for missing files", () => {
      expect(() => readText(join(dir, "missing.txt"))).toThrow();
    });
  });

  describe("writeText()", () => {
    it("creates missing parent directories", () => {
      const nested = join(dir, "a", "b", "c.txt");

      writeText(nested, "content");

      expect(readFileSync(nested, "utf-8")).toBe("content");
    });

    it("overwrites existing files", () => {
      const file = join(dir, "file.txt");
      writeText(file, "first");
      writeText(file, "second");

      expect(readFileSync(file, "utf-8")).toBe("second");
    });
  });

  describe("readJson() and writeJson()", () => {
    it("round-trips a value", () => {
      const file = join(dir, "data.json");

      writeJson(file, { name: "praxis", tags: ["a", "b"] });

      expect(readJson(file)).toEqual({ name: "praxis", tags: ["a", "b"] });
    });

    it("writeJson pretty-prints with a trailing newline and creates parents", () => {
      const file = join(dir, "nested", "data.json");

      writeJson(file, { a: 1 });

      expect(readFileSync(file, "utf-8")).toBe('{\n  "a": 1\n}\n');
    });

    it("readJson throws on invalid JSON", () => {
      writeFileSync(join(dir, "bad.json"), "not json{{{");

      expect(() => readJson(join(dir, "bad.json"))).toThrow();
    });
  });

  describe("copyFile()", () => {
    it("copies into directories that do not exist yet", () => {
      writeFileSync(join(dir, "src.txt"), "payload");
      const dest = join(dir, "deep", "dest.txt");

      copyFile(join(dir, "src.txt"), dest);

      expect(readFileSync(dest, "utf-8")).toBe("payload");
    });
  });

  describe("ensureDir()", () => {
    it("creates nested directories and is idempotent", () => {
      const nested = join(dir, "x", "y", "z");

      ensureDir(nested);
      ensureDir(nested);

      expect(exists(nested)).toBe(true);
    });
  });

  describe("removeFile()", () => {
    it("deletes a file", () => {
      const file = join(dir, "file.txt");
      writeFileSync(file, "x");

      removeFile(file);

      expect(exists(file)).toBe(false);
    });

    it("throws for missing files", () => {
      expect(() => removeFile(join(dir, "missing.txt"))).toThrow();
    });
  });
});

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

describe("matchesFilename", () => {
  it("matches exact filename", () => {
    expect(matchesFilename("README.md", "README.md")).toBe(true);
    expect(matchesFilename("SPEC.md", "SPEC.md")).toBe(true);
  });

  it("rejects non-matching exact filename", () => {
    expect(matchesFilename("SPEC.md", "README.md")).toBe(false);
    expect(matchesFilename("role.md", "README.md")).toBe(false);
  });

  it("extracts basename from full path for exact match", () => {
    expect(matchesFilename("/some/dir/README.md", "README.md")).toBe(true);
    expect(matchesFilename("/some/dir/role.md", "README.md")).toBe(false);
  });

  it("matches glob pattern with leading wildcard", () => {
    expect(matchesFilename("roles.validate.md", "*.validate.md")).toBe(true);
    expect(matchesFilename("test.validate.md", "*.validate.md")).toBe(true);
    expect(matchesFilename("roles.md", "*.validate.md")).toBe(false);
  });

  it("matches glob pattern with middle wildcard", () => {
    expect(matchesFilename("README.roles.md", "README.*.md")).toBe(true);
    expect(matchesFilename("README.context.md", "README.*.md")).toBe(true);
    expect(matchesFilename("README.md", "README.*.md")).toBe(false);
  });

  it("extracts basename from full path for glob match", () => {
    expect(matchesFilename("/project/roles/README.roles.md", "README.*.md")).toBe(true);
    expect(matchesFilename("/project/roles/some-role.md", "README.*.md")).toBe(false);
  });

  it("matches brace pattern", () => {
    expect(matchesFilename("README.md", "{README,SPEC}.md")).toBe(true);
    expect(matchesFilename("SPEC.md", "{README,SPEC}.md")).toBe(true);
    expect(matchesFilename("OTHER.md", "{README,SPEC}.md")).toBe(false);
  });
});
