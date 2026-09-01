import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import contentHash from "@/domains/eval/services/hash-content.js";
import { CacheManager } from "@/domains/eval/services/verdict-cache.js";

describe("CacheManager", () => {
  describe("default cache root", () => {
    it("defaults to .praxis/cache/validation under the project root", () => {
      const manager = new CacheManager({ projectRoot: "/project" });

      expect(manager.cacheRoot).toBe("/project/.praxis/cache/validation");
    });
  });

  let projectRoot: string;
  let cacheRoot: string;
  let manager: CacheManager;
  let cleanup: () => void;

  beforeEach(() => {
    projectRoot = join(tmpdir(), `praxis-cache-test-${randomUUID()}`);
    mkdirSync(projectRoot, { recursive: true });
    cacheRoot = join(projectRoot, ".praxis", "cache", "validation");
    manager = new CacheManager({ cacheRoot, projectRoot });

    cleanup = () => {
      rmSync(projectRoot, { recursive: true, force: true });
    };
  });

  afterEach(() => {
    cleanup();
  });

  describe("contentHash()", () => {
    it("returns first 8 characters of SHA256 hex digest", () => {
      const hash = contentHash("doc content", "readme content");

      expect(hash).toHaveLength(8);
      expect(hash).toMatch(/^[a-f0-9]{8}$/);
    });

    it("produces different hashes for different content", () => {
      const hash1 = contentHash("doc A", "readme");
      const hash2 = contentHash("doc B", "readme");

      expect(hash1).not.toBe(hash2);
    });

    it("changes when readme content changes", () => {
      const hash1 = contentHash("doc", "readme v1");
      const hash2 = contentHash("doc", "readme v2");

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("cachePathFor()", () => {
    it("strips projectRoot from absolute document paths", () => {
      const path = manager.cachePathFor(join(projectRoot, "roles", "my-role.md"));

      expect(path).toBe(join(cacheRoot, "roles", "my-role.json"));
    });

    it("handles nested source directories", () => {
      const path = manager.cachePathFor(join(projectRoot, "content", "experts", "test.md"));

      expect(path).toBe(join(cacheRoot, "content", "experts", "test.json"));
    });

    it("uses relative paths as-is when no projectRoot match", () => {
      const path = manager.cachePathFor("roles/my-role.md");

      expect(path).toBe(join(cacheRoot, "roles", "my-role.json"));
    });
  });

  describe("write() and read()", () => {
    const hash = "abcd1234";
    const result = {
      compliant: true,
      issues: [] as string[],
      reason: "All good",
    };
    const metadata = {
      specPath: "roles/README.md",
    };

    it("writes and reads back a cached result", () => {
      const targetPath = join(projectRoot, "roles", "test-expert.md");
      manager.write({ targetPath, contentHash: hash, result, metadata });
      const cached = manager.read({ targetPath, contentHash: hash, specPath: metadata.specPath });

      expect(cached).toEqual(result);
    });

    it("returns null for non-existent cache entries", () => {
      const targetPath = join(projectRoot, "roles", "test-expert.md");
      const cached = manager.read({
        targetPath,
        contentHash: "nonexist",
        specPath: metadata.specPath,
      });

      expect(cached).toBeNull();
    });

    it("returns null when hash does not match", () => {
      const targetPath = join(projectRoot, "roles", "test-expert.md");
      manager.write({ targetPath, contentHash: hash, result, metadata });
      const cached = manager.read({
        targetPath,
        contentHash: "different",
        specPath: metadata.specPath,
      });

      expect(cached).toBeNull();
    });

    it("preserves severity field through serialization", () => {
      const targetPath = join(projectRoot, "roles", "test-expert.md");
      const failResult = {
        compliant: false,
        issues: ["Missing section"],
        reason: "No — missing required section",
        severity: "error" as const,
      };

      manager.write({ targetPath, contentHash: hash, result: failResult, metadata });
      const cached = manager.read({ targetPath, contentHash: hash, specPath: metadata.specPath });

      expect(cached?.severity).toBe("error");
    });
  });

  describe("multi-spec caching", () => {
    it("caches results for two specs on the same document independently", () => {
      const targetPath = join(projectRoot, "docs", "guide.md");
      const result1 = { compliant: true, issues: [] as string[], reason: "Pass spec A" };
      const result2 = {
        compliant: false,
        issues: ["Missing section"],
        reason: "Fail spec B",
        severity: "error" as const,
      };
      const metadata1 = { specPath: "specs/README.md" };
      const metadata2 = { specPath: "other/README.md" };

      manager.write({ targetPath, contentHash: "hash1", result: result1, metadata: metadata1 });
      manager.write({ targetPath, contentHash: "hash2", result: result2, metadata: metadata2 });

      const cached1 = manager.read({
        targetPath,
        contentHash: "hash1",
        specPath: metadata1.specPath,
      });
      const cached2 = manager.read({
        targetPath,
        contentHash: "hash2",
        specPath: metadata2.specPath,
      });

      expect(cached1).toEqual(result1);
      expect(cached2).toEqual(result2);
    });

    it("stores both spec entries in a single cache file", () => {
      const targetPath = join(projectRoot, "docs", "guide.md");
      const metadata1 = { specPath: "specs/README.md" };
      const metadata2 = { specPath: "other/README.md" };

      manager.write({
        targetPath,
        contentHash: "hash1",
        result: { compliant: true, issues: [], reason: "ok" },
        metadata: metadata1,
      });
      manager.write({
        targetPath,
        contentHash: "hash2",
        result: { compliant: true, issues: [], reason: "ok" },
        metadata: metadata2,
      });

      expect(existsSync(manager.cachePathFor(targetPath))).toBe(true);
    });

    it("returns null when specPath does not match any cached entry", () => {
      const targetPath = join(projectRoot, "docs", "guide.md");
      manager.write({
        targetPath,
        contentHash: "hash1",
        result: { compliant: true, issues: [], reason: "ok" },
        metadata: { specPath: "specs/README.md" },
      });

      const cached = manager.read({
        targetPath,
        contentHash: "hash1",
        specPath: "completely/different/README.md",
      });

      expect(cached).toBeNull();
    });

    it("returns a cache hit on second run with same spec", () => {
      const targetPath = join(projectRoot, "docs", "guide.md");
      const metadata = { specPath: "specs/README.md" };

      manager.write({
        targetPath,
        contentHash: "stablehash",
        result: { compliant: true, issues: [], reason: "ok" },
        metadata,
      });

      const first = manager.read({
        targetPath,
        contentHash: "stablehash",
        specPath: metadata.specPath,
      });
      const second = manager.read({
        targetPath,
        contentHash: "stablehash",
        specPath: metadata.specPath,
      });

      expect(first).toEqual(second);
      expect(first).not.toBeNull();
    });
  });

  describe("stats()", () => {
    it("returns zero counts for empty cache", () => {
      const stats = manager.stats();

      expect(stats.totalFiles).toBe(0);
      expect(stats.totalSize).toBe(0);
    });

    it("counts cache files after writes", () => {
      manager.write({
        targetPath: join(projectRoot, "roles", "a.md"),
        contentHash: "aaaa1111",
        result: { compliant: true, issues: [], reason: "ok" },
        metadata: { specPath: "roles/README.md" },
      });
      manager.write({
        targetPath: join(projectRoot, "roles", "b.md"),
        contentHash: "bbbb2222",
        result: { compliant: true, issues: [], reason: "ok" },
        metadata: { specPath: "roles/README.md" },
      });

      const stats = manager.stats();

      expect(stats.totalFiles).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.byType["roles"]).toBe(2);
    });
  });

  describe("orphanedCacheFiles()", () => {
    it("identifies cache files for deleted documents", () => {
      mkdirSync(join(projectRoot, "roles"), { recursive: true });
      writeFileSync(join(projectRoot, "roles", "README.md"), "# Roles");

      manager.write({
        targetPath: join(projectRoot, "roles", "deleted-role.md"),
        contentHash: "dead1234",
        result: { compliant: true, issues: [], reason: "ok" },
        metadata: { specPath: "roles/README.md" },
      });

      const orphans = manager.orphanedCacheFiles(projectRoot, ["roles"]);

      expect(orphans.length).toBe(1);
      expect(orphans[0].reason).toBe("document_missing");
      expect(orphans[0].docName).toBe("deleted-role");
    });
  });

  describe("per-judge verdict keys", () => {
    const judgeA = { name: "a", model: "model-a", hash: "aaaa1111" };
    const judgeB = { name: "b", model: "model-b", hash: "bbbb2222" };

    it("stores every judge's verdicts in the target's single cache file", () => {
      const managerA = new CacheManager({ cacheRoot, projectRoot, judge: judgeA });
      const managerB = new CacheManager({ cacheRoot, projectRoot, judge: judgeB });
      const targetPath = join(projectRoot, "roles", "shared.md");

      managerA.write({
        targetPath,
        contentHash: "hash1234",
        result: { compliant: true, issues: [], reason: "judge A verdict" },
        metadata: { specPath: "roles/README.md" },
      });
      managerB.write({
        targetPath,
        contentHash: "hash1234",
        result: { compliant: false, issues: ["x"], reason: "judge B verdict", severity: "error" },
        metadata: { specPath: "roles/README.md" },
      });

      // One artifact per target — both verdicts land in the same file.
      expect(managerA.cachePathFor(targetPath)).toBe(managerB.cachePathFor(targetPath));
    });

    it("isolates verdicts between judges", () => {
      const managerA = new CacheManager({ cacheRoot, projectRoot, judge: judgeA });
      const managerB = new CacheManager({ cacheRoot, projectRoot, judge: judgeB });
      const targetPath = join(projectRoot, "roles", "shared.md");

      managerA.write({
        targetPath,
        contentHash: "hash1234",
        result: { compliant: true, issues: [], reason: "judge A verdict" },
        metadata: { specPath: "roles/README.md" },
      });

      const fromB = managerB.read({
        targetPath,
        contentHash: "hash1234",
        specPath: "roles/README.md",
      });
      const fromA = managerA.read({
        targetPath,
        contentHash: "hash1234",
        specPath: "roles/README.md",
      });

      expect(fromB).toBeNull();
      expect(fromA?.reason).toBe("judge A verdict");
    });

    it("one judge's write preserves the other judge's verdict", () => {
      const managerA = new CacheManager({ cacheRoot, projectRoot, judge: judgeA });
      const managerB = new CacheManager({ cacheRoot, projectRoot, judge: judgeB });
      const targetPath = join(projectRoot, "roles", "shared.md");
      const metadata = { specPath: "roles/README.md" };

      managerA.write({
        targetPath,
        contentHash: "hash1234",
        result: { compliant: true, issues: [], reason: "judge A verdict" },
        metadata,
      });
      managerB.write({
        targetPath,
        contentHash: "hash1234",
        result: { compliant: true, issues: [], reason: "judge B verdict" },
        metadata,
      });

      const fromA = managerA.read({
        targetPath,
        contentHash: "hash1234",
        specPath: metadata.specPath,
      });

      expect(fromA?.reason).toBe("judge A verdict");
    });

    it("readRaw returns only the bound judge's entries", () => {
      const managerA = new CacheManager({ cacheRoot, projectRoot, judge: judgeA });
      const managerB = new CacheManager({ cacheRoot, projectRoot, judge: judgeB });
      const targetPath = join(projectRoot, "roles", "shared.md");
      const metadata = { specPath: "roles/README.md" };

      managerA.write({
        targetPath,
        contentHash: "hash1234",
        result: { compliant: true, issues: [], reason: "judge A verdict" },
        metadata,
      });

      expect(managerB.readRaw({ targetPath })).toBeNull();
      expect(managerA.readRaw({ targetPath })?.result.reason).toBe("judge A verdict");
    });
  });

  describe("corrupt and unknown cache files", () => {
    it("read() deletes a corrupt cache file and returns null", () => {
      const targetPath = join(projectRoot, "roles", "corrupt.md");
      const cachePath = manager.cachePathFor(targetPath);
      mkdirSync(dirname(cachePath), { recursive: true });
      writeFileSync(cachePath, "not valid json{{{");

      const cached = manager.read({
        targetPath,
        contentHash: "anyhash1",
        specPath: "roles/README.md",
      });

      expect(cached).toBeNull();
      expect(existsSync(cachePath)).toBe(false);
    });

    it("read() returns null for an unrecognized cache version", () => {
      const targetPath = join(projectRoot, "roles", "future.md");
      const cachePath = manager.cachePathFor(targetPath);
      mkdirSync(dirname(cachePath), { recursive: true });
      writeFileSync(cachePath, JSON.stringify({ version: "99.0", something: "else" }));

      const cached = manager.read({
        targetPath,
        contentHash: "anyhash1",
        specPath: "roles/README.md",
      });

      expect(cached).toBeNull();
    });

    it("write() replaces a corrupt cache file with a fresh v2.0 file", () => {
      const targetPath = join(projectRoot, "roles", "corrupt.md");
      const cachePath = manager.cachePathFor(targetPath);
      mkdirSync(dirname(cachePath), { recursive: true });
      writeFileSync(cachePath, "not valid json{{{");

      manager.write({
        targetPath,
        contentHash: "newhash1",
        result: { compliant: true, issues: [], reason: "recovered" },
        metadata: { specPath: "roles/README.md" },
      });

      const cached = manager.read({
        targetPath,
        contentHash: "newhash1",
        specPath: "roles/README.md",
      });
      expect(cached?.reason).toBe("recovered");
    });
  });

  describe("readRaw()", () => {
    const hash = "abcd1234";
    const result = {
      compliant: true,
      issues: [] as string[],
      reason: "All good",
    };
    const metadata = {
      specPath: "roles/README.md",
    };

    it("returns full cache data without hash validation", () => {
      const targetPath = join(projectRoot, "roles", "test-expert.md");
      manager.write({ targetPath, contentHash: hash, result, metadata });
      const cached = manager.readRaw({ targetPath, specPath: metadata.specPath });

      expect(cached).not.toBeNull();
      expect(cached!.version).toBe("3.0");
      expect(cached!.content_hash).toBe(hash);
      expect(cached!.cached_at).toBeTruthy();
      expect(cached!.document.path).toBe(targetPath);
      expect(cached!.document.spec_path).toBe("roles/README.md");
      expect(cached!.result).toEqual(result);
    });

    it("returns first entry when specPath is omitted", () => {
      const targetPath = join(projectRoot, "roles", "test-expert.md");
      manager.write({ targetPath, contentHash: hash, result, metadata });
      const cached = manager.readRaw({ targetPath });

      expect(cached).not.toBeNull();
      expect(cached!.result).toEqual(result);
    });

    it("returns null when no cache file exists", () => {
      const targetPath = join(projectRoot, "roles", "nonexistent.md");
      const cached = manager.readRaw({ targetPath });

      expect(cached).toBeNull();
    });

    it("returns data even when hash would not match read()", () => {
      const targetPath = join(projectRoot, "roles", "test-expert.md");
      manager.write({ targetPath, contentHash: hash, result, metadata });

      const readResult = manager.read({
        targetPath,
        contentHash: "different",
        specPath: metadata.specPath,
      });
      expect(readResult).toBeNull();

      const rawResult = manager.readRaw({ targetPath, specPath: metadata.specPath });
      expect(rawResult).not.toBeNull();
      expect(rawResult!.content_hash).toBe(hash);
    });

    it("does not delete corrupt cache files", () => {
      const targetPath = join(projectRoot, "roles", "corrupt.md");
      const cachePath = manager.cachePathFor(targetPath);
      mkdirSync(dirname(cachePath), { recursive: true });
      writeFileSync(cachePath, "not valid json{{{");

      const cached = manager.readRaw({ targetPath });
      expect(cached).toBeNull();
      expect(existsSync(cachePath)).toBe(true);
    });
  });

  describe("readAllRaw()", () => {
    it("returns all spec entries for a document with multiple validations", () => {
      const targetPath = join(projectRoot, "docs", "guide.md");
      const metadata1 = { specPath: "specs/README.md" };
      const metadata2 = { specPath: "other/README.md" };

      manager.write({
        targetPath,
        contentHash: "hash1",
        result: { compliant: true, issues: [], reason: "spec A ok" },
        metadata: metadata1,
      });
      manager.write({
        targetPath,
        contentHash: "hash2",
        result: {
          compliant: false,
          issues: ["issue"],
          reason: "spec B fail",
          severity: "error" as const,
        },
        metadata: metadata2,
      });

      const all = manager.readAllRaw({ targetPath });

      expect(all).toHaveLength(2);
      const reasons = all.map((e) => e.result.reason).sort();
      expect(reasons).toEqual(["spec A ok", "spec B fail"]);
    });

    it("returns empty array when no cache file exists", () => {
      const targetPath = join(projectRoot, "roles", "nonexistent.md");
      const all = manager.readAllRaw({ targetPath });

      expect(all).toHaveLength(0);
    });

    it("returns a single entry for a document with one validation", () => {
      const targetPath = join(projectRoot, "roles", "test-expert.md");
      manager.write({
        targetPath,
        contentHash: "hash1",
        result: { compliant: true, issues: [], reason: "ok" },
        metadata: { specPath: "roles/README.md" },
      });

      const all = manager.readAllRaw({ targetPath });

      expect(all).toHaveLength(1);
      expect(all[0].result.reason).toBe("ok");
    });
  });

  describe("text sanitization", () => {
    const metadata = { specPath: "roles/README.md" };

    it("strips control characters and double quotes from reason and issues", () => {
      const targetPath = join(projectRoot, "roles", "test-expert.md");
      const hash = "abcd1234";
      const result = {
        compliant: false,
        issues: ['issue with \x00 null byte and "quotes"'],
        reason: 'No \x01\x02\x03 — bad chars here\x00 and "quoted text"',
        severity: "error" as const,
      };

      manager.write({ targetPath, contentHash: hash, result, metadata });
      const cached = manager.read({ targetPath, contentHash: hash, specPath: metadata.specPath });

      expect(cached).not.toBeNull();
      expect(cached!.reason).not.toContain("\x00");
      expect(cached!.reason).not.toContain("\x01");
      expect(cached!.reason).not.toContain('"');
      expect(cached!.reason).toContain("'quoted text'");
      expect(cached!.issues[0]).not.toContain("\x00");
      expect(cached!.issues[0]).not.toContain('"');
    });

    it("preserves newlines and tabs in reason text", () => {
      const targetPath = join(projectRoot, "roles", "test-expert.md");
      const hash = "abcd1234";
      const result = {
        compliant: true,
        issues: [] as string[],
        reason: "Yes\n\tAll good\nNo issues",
      };

      manager.write({ targetPath, contentHash: hash, result, metadata });
      const cached = manager.read({ targetPath, contentHash: hash, specPath: metadata.specPath });

      expect(cached!.reason).toContain("\n");
      expect(cached!.reason).toContain("\t");
    });
  });
});
