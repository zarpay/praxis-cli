import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { VerdictCache } from "@/models/verdict-cache.js";

describe("VerdictCache", () => {
  let projectRoot: string;
  let cacheRoot: string;
  let cache: VerdictCache;

  beforeEach(() => {
    projectRoot = join(tmpdir(), `praxis-cache-test-${randomUUID()}`);
    mkdirSync(projectRoot, { recursive: true });
    cacheRoot = join(projectRoot, ".praxis", "cache", "validation");
    cache = new VerdictCache({ cacheRoot, projectRoot });
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it("defaults its root to .praxis/cache/validation under the project root", () => {
    const bare = new VerdictCache({ projectRoot: "/project" });

    expect(bare.root).toBe("/project/.praxis/cache/validation");
  });

  describe("pathFor", () => {
    it("strips projectRoot from absolute document paths", () => {
      const path = cache.pathFor(join(projectRoot, "roles", "my-role.md"));

      expect(path).toBe(join(cacheRoot, "roles", "my-role.json"));
    });

    it("handles nested source directories", () => {
      const path = cache.pathFor(join(projectRoot, "content", "experts", "test.md"));

      expect(path).toBe(join(cacheRoot, "content", "experts", "test.json"));
    });

    it("uses relative paths as-is when no projectRoot match", () => {
      const path = cache.pathFor("roles/my-role.md");

      expect(path).toBe(join(cacheRoot, "roles", "my-role.json"));
    });

    it("gives every reviewer the same file for one target", () => {
      const a = new VerdictCache({
        cacheRoot,
        projectRoot,
        reviewer: { name: "a", model: "m", hash: "aaaa1111" },
      });
      const b = new VerdictCache({
        cacheRoot,
        projectRoot,
        reviewer: { name: "b", model: "m", hash: "bbbb2222" },
      });
      const targetPath = join(projectRoot, "roles", "shared.md");

      // One artifact per target — every reviewer's verdicts land in it.
      expect(a.pathFor(targetPath)).toBe(b.pathFor(targetPath));
    });
  });

  describe("keyFor", () => {
    it("keys an entry on the spec and the bound reviewer's hash", () => {
      const a = new VerdictCache({
        cacheRoot,
        projectRoot,
        reviewer: { name: "a", model: "m", hash: "aaaa1111" },
      });
      const b = new VerdictCache({
        cacheRoot,
        projectRoot,
        reviewer: { name: "b", model: "m", hash: "bbbb2222" },
      });

      expect(a.keyFor("roles/README.md")).not.toBe(b.keyFor("roles/README.md"));
      expect(a.keyFor("roles/README.md")).toBe(a.keyFor("roles/README.md"));
    });

    it("keys different specs differently for one reviewer", () => {
      expect(cache.keyFor("roles/README.md")).not.toBe(cache.keyFor("docs/README.md"));
    });
  });

  describe("relativeToRoot", () => {
    it("makes an absolute path project-relative, so cache files are portable", () => {
      const rel = cache.relativeToRoot(join(projectRoot, "roles", "a.md"));

      expect(rel).toBe(join("roles", "a.md"));
    });
  });
});
