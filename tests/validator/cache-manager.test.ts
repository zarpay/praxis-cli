import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CacheManager, contentHash } from "@/validator/cache-manager.js";

describe("CacheManager", () => {
  let projectRoot: string;
  let cacheRoot: string;
  let manager: CacheManager;
  let cleanup: () => void;

  beforeEach(() => {
    projectRoot = join(tmpdir(), `praxis-cache-test-${randomUUID()}`);
    mkdirSync(projectRoot, { recursive: true });
    cacheRoot = join(projectRoot, ".praxis", "cache", "validation");
    manager = new CacheManager(cacheRoot, projectRoot);

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
      const path = manager.cachePathFor(join(projectRoot, "content", "roles", "test.md"));

      expect(path).toBe(join(cacheRoot, "content", "roles", "test.json"));
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
      documentType: "role",
      specPath: "roles/README.md",
    };

    it("writes and reads back a cached result", () => {
      const documentPath = join(projectRoot, "roles", "test-role.md");
      manager.write({ documentPath, contentHash: hash, result, metadata });
      const cached = manager.read({ documentPath, contentHash: hash, specPath: metadata.specPath });

      expect(cached).toEqual(result);
    });

    it("returns null for non-existent cache entries", () => {
      const documentPath = join(projectRoot, "roles", "test-role.md");
      const cached = manager.read({
        documentPath,
        contentHash: "nonexist",
        specPath: metadata.specPath,
      });

      expect(cached).toBeNull();
    });

    it("returns null when hash does not match", () => {
      const documentPath = join(projectRoot, "roles", "test-role.md");
      manager.write({ documentPath, contentHash: hash, result, metadata });
      const cached = manager.read({
        documentPath,
        contentHash: "different",
        specPath: metadata.specPath,
      });

      expect(cached).toBeNull();
    });

    it("preserves severity field through serialization", () => {
      const documentPath = join(projectRoot, "roles", "test-role.md");
      const failResult = {
        compliant: false,
        issues: ["Missing section"],
        reason: "No — missing required section",
        severity: "error" as const,
      };

      manager.write({ documentPath, contentHash: hash, result: failResult, metadata });
      const cached = manager.read({ documentPath, contentHash: hash, specPath: metadata.specPath });

      expect(cached?.severity).toBe("error");
    });
  });

  describe("multi-spec caching", () => {
    it("caches results for two specs on the same document independently", () => {
      const documentPath = join(projectRoot, "docs", "guide.md");
      const result1 = { compliant: true, issues: [] as string[], reason: "Pass spec A" };
      const result2 = {
        compliant: false,
        issues: ["Missing section"],
        reason: "Fail spec B",
        severity: "error" as const,
      };
      const metadata1 = { documentType: "reference", specPath: "specs/README.md" };
      const metadata2 = { documentType: "reference", specPath: "other/README.md" };

      manager.write({ documentPath, contentHash: "hash1", result: result1, metadata: metadata1 });
      manager.write({ documentPath, contentHash: "hash2", result: result2, metadata: metadata2 });

      const cached1 = manager.read({
        documentPath,
        contentHash: "hash1",
        specPath: metadata1.specPath,
      });
      const cached2 = manager.read({
        documentPath,
        contentHash: "hash2",
        specPath: metadata2.specPath,
      });

      expect(cached1).toEqual(result1);
      expect(cached2).toEqual(result2);
    });

    it("stores both spec entries in a single cache file", () => {
      const documentPath = join(projectRoot, "docs", "guide.md");
      const metadata1 = { documentType: "reference", specPath: "specs/README.md" };
      const metadata2 = { documentType: "reference", specPath: "other/README.md" };

      manager.write({
        documentPath,
        contentHash: "hash1",
        result: { compliant: true, issues: [], reason: "ok" },
        metadata: metadata1,
      });
      manager.write({
        documentPath,
        contentHash: "hash2",
        result: { compliant: true, issues: [], reason: "ok" },
        metadata: metadata2,
      });

      expect(existsSync(manager.cachePathFor(documentPath))).toBe(true);
    });

    it("returns null when specPath does not match any cached entry", () => {
      const documentPath = join(projectRoot, "docs", "guide.md");
      manager.write({
        documentPath,
        contentHash: "hash1",
        result: { compliant: true, issues: [], reason: "ok" },
        metadata: { documentType: "reference", specPath: "specs/README.md" },
      });

      const cached = manager.read({
        documentPath,
        contentHash: "hash1",
        specPath: "completely/different/README.md",
      });

      expect(cached).toBeNull();
    });

    it("returns a cache hit on second run with same spec", () => {
      const documentPath = join(projectRoot, "docs", "guide.md");
      const metadata = { documentType: "reference", specPath: "specs/README.md" };

      manager.write({
        documentPath,
        contentHash: "stablehash",
        result: { compliant: true, issues: [], reason: "ok" },
        metadata,
      });

      const first = manager.read({
        documentPath,
        contentHash: "stablehash",
        specPath: metadata.specPath,
      });
      const second = manager.read({
        documentPath,
        contentHash: "stablehash",
        specPath: metadata.specPath,
      });

      expect(first).toEqual(second);
      expect(first).not.toBeNull();
    });
  });

  describe("v1.0 migration", () => {
    it("transparently migrates a v1.0 cache file to v2.0 on write", () => {
      const documentPath = join(projectRoot, "roles", "test-role.md");
      const cachePath = manager.cachePathFor(documentPath);

      const v1Data = {
        version: "1.0",
        cached_at: "2025-01-01T00:00:00.000Z",
        content_hash: "oldhash1",
        document: { path: documentPath, type: "role", spec_path: "roles/README.md" },
        result: { compliant: true, issues: [] as string[], reason: "Old cached result" },
      };
      mkdirSync(dirname(cachePath), { recursive: true });
      writeFileSync(cachePath, JSON.stringify(v1Data, null, 2));

      manager.write({
        documentPath,
        contentHash: "newhash1",
        result: { compliant: true, issues: [], reason: "New result" },
        metadata: { documentType: "role", specPath: "roles/OTHER-README.md" },
      });

      const oldCached = manager.read({
        documentPath,
        contentHash: "oldhash1",
        specPath: "roles/README.md",
      });
      expect(oldCached?.reason).toBe("Old cached result");

      const newCached = manager.read({
        documentPath,
        contentHash: "newhash1",
        specPath: "roles/OTHER-README.md",
      });
      expect(newCached?.reason).toBe("New result");
    });

    it("reads a v1.0 cache file without migration via read()", () => {
      const documentPath = join(projectRoot, "roles", "test-role.md");
      const cachePath = manager.cachePathFor(documentPath);

      const v1Data = {
        version: "1.0",
        cached_at: "2025-01-01T00:00:00.000Z",
        content_hash: "oldhash1",
        document: { path: documentPath, type: "role", spec_path: "roles/README.md" },
        result: { compliant: true, issues: [] as string[], reason: "Cached" },
      };
      mkdirSync(dirname(cachePath), { recursive: true });
      writeFileSync(cachePath, JSON.stringify(v1Data, null, 2));

      const cached = manager.read({
        documentPath,
        contentHash: "oldhash1",
        specPath: "roles/README.md",
      });

      expect(cached?.reason).toBe("Cached");
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
        documentPath: join(projectRoot, "roles", "a.md"),
        contentHash: "aaaa1111",
        result: { compliant: true, issues: [], reason: "ok" },
        metadata: { documentType: "role", specPath: "roles/README.md" },
      });
      manager.write({
        documentPath: join(projectRoot, "roles", "b.md"),
        contentHash: "bbbb2222",
        result: { compliant: true, issues: [], reason: "ok" },
        metadata: { documentType: "role", specPath: "roles/README.md" },
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
        documentPath: join(projectRoot, "roles", "deleted-role.md"),
        contentHash: "dead1234",
        result: { compliant: true, issues: [], reason: "ok" },
        metadata: { documentType: "role", specPath: "roles/README.md" },
      });

      const orphans = manager.orphanedCacheFiles(projectRoot, ["roles"]);

      expect(orphans.length).toBe(1);
      expect(orphans[0].reason).toBe("document_missing");
      expect(orphans[0].docName).toBe("deleted-role");
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
      documentType: "role",
      specPath: "roles/README.md",
    };

    it("returns full cache data without hash validation", () => {
      const documentPath = join(projectRoot, "roles", "test-role.md");
      manager.write({ documentPath, contentHash: hash, result, metadata });
      const cached = manager.readRaw({ documentPath, specPath: metadata.specPath });

      expect(cached).not.toBeNull();
      expect(cached!.version).toBe("2.0");
      expect(cached!.content_hash).toBe(hash);
      expect(cached!.cached_at).toBeTruthy();
      expect(cached!.document.path).toBe(documentPath);
      expect(cached!.document.type).toBe("role");
      expect(cached!.document.spec_path).toBe("roles/README.md");
      expect(cached!.result).toEqual(result);
    });

    it("returns first entry when specPath is omitted", () => {
      const documentPath = join(projectRoot, "roles", "test-role.md");
      manager.write({ documentPath, contentHash: hash, result, metadata });
      const cached = manager.readRaw({ documentPath });

      expect(cached).not.toBeNull();
      expect(cached!.result).toEqual(result);
    });

    it("returns null when no cache file exists", () => {
      const documentPath = join(projectRoot, "roles", "nonexistent.md");
      const cached = manager.readRaw({ documentPath });

      expect(cached).toBeNull();
    });

    it("returns data even when hash would not match read()", () => {
      const documentPath = join(projectRoot, "roles", "test-role.md");
      manager.write({ documentPath, contentHash: hash, result, metadata });

      const readResult = manager.read({
        documentPath,
        contentHash: "different",
        specPath: metadata.specPath,
      });
      expect(readResult).toBeNull();

      const rawResult = manager.readRaw({ documentPath, specPath: metadata.specPath });
      expect(rawResult).not.toBeNull();
      expect(rawResult!.content_hash).toBe(hash);
    });

    it("does not delete corrupt cache files", () => {
      const documentPath = join(projectRoot, "roles", "corrupt.md");
      const cachePath = manager.cachePathFor(documentPath);
      mkdirSync(dirname(cachePath), { recursive: true });
      writeFileSync(cachePath, "not valid json{{{");

      const cached = manager.readRaw({ documentPath });
      expect(cached).toBeNull();
      expect(existsSync(cachePath)).toBe(true);
    });
  });

  describe("readAllRaw()", () => {
    it("returns all spec entries for a document with multiple validations", () => {
      const documentPath = join(projectRoot, "docs", "guide.md");
      const metadata1 = { documentType: "reference", specPath: "specs/README.md" };
      const metadata2 = { documentType: "reference", specPath: "other/README.md" };

      manager.write({
        documentPath,
        contentHash: "hash1",
        result: { compliant: true, issues: [], reason: "spec A ok" },
        metadata: metadata1,
      });
      manager.write({
        documentPath,
        contentHash: "hash2",
        result: {
          compliant: false,
          issues: ["issue"],
          reason: "spec B fail",
          severity: "error" as const,
        },
        metadata: metadata2,
      });

      const all = manager.readAllRaw({ documentPath });

      expect(all).toHaveLength(2);
      const reasons = all.map((e) => e.result.reason).sort();
      expect(reasons).toEqual(["spec A ok", "spec B fail"]);
    });

    it("returns empty array when no cache file exists", () => {
      const documentPath = join(projectRoot, "roles", "nonexistent.md");
      const all = manager.readAllRaw({ documentPath });

      expect(all).toHaveLength(0);
    });

    it("returns a single entry for a document with one validation", () => {
      const documentPath = join(projectRoot, "roles", "test-role.md");
      manager.write({
        documentPath,
        contentHash: "hash1",
        result: { compliant: true, issues: [], reason: "ok" },
        metadata: { documentType: "role", specPath: "roles/README.md" },
      });

      const all = manager.readAllRaw({ documentPath });

      expect(all).toHaveLength(1);
      expect(all[0].result.reason).toBe("ok");
    });
  });

  describe("text sanitization", () => {
    const metadata = { documentType: "role", specPath: "roles/README.md" };

    it("strips control characters and double quotes from reason and issues", () => {
      const documentPath = join(projectRoot, "roles", "test-role.md");
      const hash = "abcd1234";
      const result = {
        compliant: false,
        issues: ['issue with \x00 null byte and "quotes"'],
        reason: 'No \x01\x02\x03 — bad chars here\x00 and "quoted text"',
        severity: "error" as const,
      };

      manager.write({ documentPath, contentHash: hash, result, metadata });
      const cached = manager.read({ documentPath, contentHash: hash, specPath: metadata.specPath });

      expect(cached).not.toBeNull();
      expect(cached!.reason).not.toContain("\x00");
      expect(cached!.reason).not.toContain("\x01");
      expect(cached!.reason).not.toContain('"');
      expect(cached!.reason).toContain("'quoted text'");
      expect(cached!.issues[0]).not.toContain("\x00");
      expect(cached!.issues[0]).not.toContain('"');
    });

    it("preserves newlines and tabs in reason text", () => {
      const documentPath = join(projectRoot, "roles", "test-role.md");
      const hash = "abcd1234";
      const result = {
        compliant: true,
        issues: [] as string[],
        reason: "Yes\n\tAll good\nNo issues",
      };

      manager.write({ documentPath, contentHash: hash, result, metadata });
      const cached = manager.read({ documentPath, contentHash: hash, specPath: metadata.specPath });

      expect(cached!.reason).toContain("\n");
      expect(cached!.reason).toContain("\t");
    });
  });
});
