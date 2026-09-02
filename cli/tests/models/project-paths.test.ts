import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { Paths } from "@/models/project-paths.js";

describe("Paths", () => {
  const dirs: string[] = [];

  function makeTmpdir(): string {
    const dir = join(tmpdir(), `praxis-paths-test-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    dirs.push(dir);
    return dir;
  }

  afterEach(() => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    dirs.length = 0;
  });

  it("finds root by .praxis/ directory", () => {
    const dir = makeTmpdir();
    mkdirSync(join(dir, ".praxis"), { recursive: true });

    const paths = new Paths(dir);
    expect(paths.root).toBe(dir);
  });

  it("walks up to find .praxis/ directory", () => {
    const dir = makeTmpdir();
    mkdirSync(join(dir, ".praxis"), { recursive: true });
    const nested = join(dir, "some", "nested", "dir");
    mkdirSync(nested, { recursive: true });

    const paths = new Paths(nested);
    expect(paths.root).toBe(dir);
  });

  it("throws when no .praxis/ directory is found", () => {
    const dir = makeTmpdir();

    const paths = new Paths(dir);
    expect(() => paths.root).toThrow("Could not find Praxis root (no .praxis/ directory found)");
  });

  it("caches root after first lookup", () => {
    const dir = makeTmpdir();
    mkdirSync(join(dir, ".praxis"), { recursive: true });

    const paths = new Paths(dir);
    const root1 = paths.root;
    const root2 = paths.root;
    expect(root1).toBe(root2);
  });

  it("resolves relative paths against root", () => {
    const dir = makeTmpdir();
    mkdirSync(join(dir, ".praxis"), { recursive: true });

    const paths = new Paths(dir);
    expect(paths.resolve("some/path")).toBe(join(dir, "some/path"));
  });

  it("converts absolute paths to relative", () => {
    const dir = makeTmpdir();
    mkdirSync(join(dir, ".praxis"), { recursive: true });

    const paths = new Paths(dir);
    expect(paths.relative(join(dir, "some", "path"))).toBe(join("some", "path"));
  });

  it("returns absolute path unchanged when not under root", () => {
    const dir = makeTmpdir();
    mkdirSync(join(dir, ".praxis"), { recursive: true });

    const paths = new Paths(dir);
    expect(paths.relative("/other/path")).toBe("/other/path");
  });
});
