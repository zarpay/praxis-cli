import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CacheManager, contentHash } from "@/validator/cache-manager.js";

describe("CacheManager", () => {
  let cacheRoot: string;
  let manager: CacheManager;
  let cleanup: () => void;

  beforeEach(() => {
    const dir = join(tmpdir(), `praxis-cache-test-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    cacheRoot = dir;
    manager = new CacheManager(cacheRoot);

    cleanup = () => {
      rmSync(dir, { recursive: true, force: true });
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
    it("generates path with document name and hash", () => {
      const path = manager.cachePathFor("content/roles/my-role.md", "abcd1234");

      expect(path).toBe(join(cacheRoot, "roles", "my-role_abcd1234.json"));
    });

    it("handles absolute paths with /content/ segment", () => {
      const path = manager.cachePathFor("/home/user/praxis/content/roles/test.md", "abcd1234");

      expect(path).toBe(join(cacheRoot, "roles", "test_abcd1234.json"));
    });
  });

  describe("write() and read()", () => {
    const documentPath = "content/roles/test-role.md";
    const hash = "abcd1234";
    const result = {
      compliant: true,
      issues: [] as string[],
      reason: "All good",
    };
    const metadata = {
      documentType: "role",
      specPath: "content/roles/README.md",
    };

    it("writes and reads back a cached result", () => {
      manager.write({ documentPath, contentHash: hash, result, metadata });
      const cached = manager.read({ documentPath, contentHash: hash });

      expect(cached).toEqual(result);
    });

    it("returns null for non-existent cache entries", () => {
      const cached = manager.read({ documentPath, contentHash: "nonexist" });

      expect(cached).toBeNull();
    });

    it("returns null when hash does not match", () => {
      manager.write({ documentPath, contentHash: hash, result, metadata });
      const cached = manager.read({ documentPath, contentHash: "different" });

      expect(cached).toBeNull();
    });

    it("preserves severity field through serialization", () => {
      const failResult = {
        compliant: false,
        issues: ["Missing section"],
        reason: "No — missing required section",
        severity: "error" as const,
      };

      manager.write({ documentPath, contentHash: hash, result: failResult, metadata });
      const cached = manager.read({ documentPath, contentHash: hash });

      expect(cached?.severity).toBe("error");
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
        documentPath: "content/roles/a.md",
        contentHash: "aaaa1111",
        result: { compliant: true, issues: [], reason: "ok" },
        metadata: { documentType: "role", specPath: "content/roles/README.md" },
      });
      manager.write({
        documentPath: "content/roles/b.md",
        contentHash: "bbbb2222",
        result: { compliant: true, issues: [], reason: "ok" },
        metadata: { documentType: "role", specPath: "content/roles/README.md" },
      });

      const stats = manager.stats();

      expect(stats.totalFiles).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.byType["roles"]).toBe(2);
    });
  });

  describe("orphanedCacheFiles()", () => {
    it("identifies cache files for deleted documents", () => {
      const contentDir = join(cacheRoot, "..", "content");
      mkdirSync(join(contentDir, "roles"), { recursive: true });
      writeFileSync(join(contentDir, "roles", "README.md"), "---\ntitle: Roles\n---\n# Roles");

      // Write a cache entry for a document that doesn't exist
      manager.write({
        documentPath: "content/roles/deleted-role.md",
        contentHash: "dead1234",
        result: { compliant: true, issues: [], reason: "ok" },
        metadata: { documentType: "role", specPath: "content/roles/README.md" },
      });

      const orphans = manager.orphanedCacheFiles(contentDir);

      expect(orphans.length).toBe(1);
      expect(orphans[0].reason).toBe("document_missing");
      expect(orphans[0].docName).toBe("deleted-role");
    });
  });
});
