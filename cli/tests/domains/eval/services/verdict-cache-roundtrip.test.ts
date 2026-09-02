import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { VerdictCache } from "@/domains/eval/models/verdict-cache.js";
import readVerdictEntry from "@/domains/eval/services/read-verdict-entry-service.js";
import readVerdict from "@/domains/eval/services/read-verdict-service.js";
import writeVerdict from "@/domains/eval/services/write-verdict-service.js";

describe("the verdict cache", () => {
  describe("default cache root", () => {
    it("defaults to .praxis/cache/validation under the project root", () => {
      const cache = new VerdictCache({ projectRoot: "/project" });

      expect(cache.root).toBe("/project/.praxis/cache/validation");
    });
  });

  let projectRoot: string;
  let cacheRoot: string;
  let cache: VerdictCache;
  let cleanup: () => void;

  beforeEach(() => {
    projectRoot = join(tmpdir(), `praxis-cache-test-${randomUUID()}`);
    mkdirSync(projectRoot, { recursive: true });
    cacheRoot = join(projectRoot, ".praxis", "cache", "validation");
    cache = new VerdictCache({ cacheRoot, projectRoot });

    cleanup = () => {
      rmSync(projectRoot, { recursive: true, force: true });
    };
  });

  afterEach(() => {
    cleanup();
  });

  describe("cachePathFor()", () => {
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
  });

  describe("write() and read()", () => {
    const hash = "abcd1234";
    const result = {
      compliant: true,
      issues: [] as string[],
      reason: "All good",
    };
    const specPath = "roles/README.md";

    it("writes and reads back a cached result", () => {
      const targetPath = join(projectRoot, "roles", "test-expert.md");
      writeVerdict({ cache, targetPath, contentHash: hash, result, specPath });
      const cached = readVerdict({
        cache,
        targetPath,
        contentHash: hash,
        specPath,
      });

      expect(cached).toEqual(result);
    });

    it("returns null for non-existent cache entries", () => {
      const targetPath = join(projectRoot, "roles", "test-expert.md");
      const cached = readVerdict({
        cache,
        targetPath,
        contentHash: "nonexist",
        specPath,
      });

      expect(cached).toBeNull();
    });

    it("returns null when hash does not match", () => {
      const targetPath = join(projectRoot, "roles", "test-expert.md");
      writeVerdict({ cache, targetPath, contentHash: hash, result, specPath });
      const cached = readVerdict({
        cache,
        targetPath,
        contentHash: "different",
        specPath,
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

      writeVerdict({ cache, targetPath, contentHash: hash, result: failResult, specPath });
      const cached = readVerdict({
        cache,
        targetPath,
        contentHash: hash,
        specPath,
      });

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
      const specPath1 = "specs/README.md";
      const specPath2 = "other/README.md";

      writeVerdict({
        cache,
        targetPath,
        contentHash: "hash1",
        result: result1,
        specPath: specPath1,
      });
      writeVerdict({
        cache,
        targetPath,
        contentHash: "hash2",
        result: result2,
        specPath: specPath2,
      });

      const cached1 = readVerdict({
        cache,
        targetPath,
        contentHash: "hash1",
        specPath: specPath1,
      });
      const cached2 = readVerdict({
        cache,
        targetPath,
        contentHash: "hash2",
        specPath: specPath2,
      });

      expect(cached1).toEqual(result1);
      expect(cached2).toEqual(result2);
    });

    it("stores both spec entries in a single cache file", () => {
      const targetPath = join(projectRoot, "docs", "guide.md");
      const specPath1 = "specs/README.md";
      const specPath2 = "other/README.md";

      writeVerdict({
        cache,
        targetPath,
        contentHash: "hash1",
        result: { compliant: true, issues: [], reason: "ok" },
        specPath: specPath1,
      });
      writeVerdict({
        cache,
        targetPath,
        contentHash: "hash2",
        result: { compliant: true, issues: [], reason: "ok" },
        specPath: specPath2,
      });

      expect(existsSync(cache.pathFor(targetPath))).toBe(true);
    });

    it("returns null when specPath does not match any cached entry", () => {
      const targetPath = join(projectRoot, "docs", "guide.md");
      writeVerdict({
        cache,
        targetPath,
        contentHash: "hash1",
        result: { compliant: true, issues: [], reason: "ok" },
        specPath: "specs/README.md",
      });

      const cached = readVerdict({
        cache,
        targetPath,
        contentHash: "hash1",
        specPath: "completely/different/README.md",
      });

      expect(cached).toBeNull();
    });

    it("returns a cache hit on second run with same spec", () => {
      const targetPath = join(projectRoot, "docs", "guide.md");
      const specPath = "specs/README.md";

      writeVerdict({
        cache,
        targetPath,
        contentHash: "stablehash",
        result: { compliant: true, issues: [], reason: "ok" },
        specPath,
      });

      const first = readVerdict({
        cache,
        targetPath,
        contentHash: "stablehash",
        specPath,
      });
      const second = readVerdict({
        cache,
        targetPath,
        contentHash: "stablehash",
        specPath,
      });

      expect(first).toEqual(second);
      expect(first).not.toBeNull();
    });
  });

  describe("per-reviewer verdict keys", () => {
    const reviewerA = { name: "a", model: "model-a", hash: "aaaa1111" };
    const reviewerB = { name: "b", model: "model-b", hash: "bbbb2222" };

    it("stores every reviewer's verdicts in the target's single cache file", () => {
      const cacheA = new VerdictCache({ cacheRoot, projectRoot, reviewer: reviewerA });
      const cacheB = new VerdictCache({ cacheRoot, projectRoot, reviewer: reviewerB });
      const targetPath = join(projectRoot, "roles", "shared.md");

      writeVerdict({
        cache: cacheA,
        targetPath,
        contentHash: "hash1234",
        result: { compliant: true, issues: [], reason: "reviewer A verdict" },
        specPath: "roles/README.md",
      });
      writeVerdict({
        cache: cacheB,
        targetPath,
        contentHash: "hash1234",
        result: {
          compliant: false,
          issues: ["x"],
          reason: "reviewer B verdict",
          severity: "error",
        },
        specPath: "roles/README.md",
      });

      // One artifact per target — both verdicts land in the same file.
      expect(cacheA.pathFor(targetPath)).toBe(cacheB.pathFor(targetPath));
    });

    it("isolates verdicts between reviewers", () => {
      const cacheA = new VerdictCache({ cacheRoot, projectRoot, reviewer: reviewerA });
      const cacheB = new VerdictCache({ cacheRoot, projectRoot, reviewer: reviewerB });
      const targetPath = join(projectRoot, "roles", "shared.md");

      writeVerdict({
        cache: cacheA,
        targetPath,
        contentHash: "hash1234",
        result: { compliant: true, issues: [], reason: "reviewer A verdict" },
        specPath: "roles/README.md",
      });

      const fromB = readVerdict({
        cache: cacheB,
        targetPath,
        contentHash: "hash1234",
        specPath: "roles/README.md",
      });
      const fromA = readVerdict({
        cache: cacheA,
        targetPath,
        contentHash: "hash1234",
        specPath: "roles/README.md",
      });

      expect(fromB).toBeNull();
      expect(fromA?.reason).toBe("reviewer A verdict");
    });

    it("one reviewer's write preserves the other reviewer's verdict", () => {
      const cacheA = new VerdictCache({ cacheRoot, projectRoot, reviewer: reviewerA });
      const cacheB = new VerdictCache({ cacheRoot, projectRoot, reviewer: reviewerB });
      const targetPath = join(projectRoot, "roles", "shared.md");
      const specPath = "roles/README.md";

      writeVerdict({
        cache: cacheA,
        targetPath,
        contentHash: "hash1234",
        result: { compliant: true, issues: [], reason: "reviewer A verdict" },
        specPath,
      });
      writeVerdict({
        cache: cacheB,
        targetPath,
        contentHash: "hash1234",
        result: { compliant: true, issues: [], reason: "reviewer B verdict" },
        specPath,
      });

      const fromA = readVerdict({
        cache: cacheA,
        targetPath,
        contentHash: "hash1234",
        specPath,
      });

      expect(fromA?.reason).toBe("reviewer A verdict");
    });

    it("readRaw returns only the bound reviewer's entries", () => {
      const cacheA = new VerdictCache({ cacheRoot, projectRoot, reviewer: reviewerA });
      const cacheB = new VerdictCache({ cacheRoot, projectRoot, reviewer: reviewerB });
      const targetPath = join(projectRoot, "roles", "shared.md");
      const specPath = "roles/README.md";

      writeVerdict({
        cache: cacheA,
        targetPath,
        contentHash: "hash1234",
        result: { compliant: true, issues: [], reason: "reviewer A verdict" },
        specPath,
      });

      expect(readVerdictEntry({ cache: cacheB, targetPath })).toBeNull();
      expect(readVerdictEntry({ cache: cacheA, targetPath })?.result.reason).toBe(
        "reviewer A verdict",
      );
    });
  });

  describe("corrupt and unknown cache files", () => {
    it("read() deletes a corrupt cache file and returns null", () => {
      const targetPath = join(projectRoot, "roles", "corrupt.md");
      const cachePath = cache.pathFor(targetPath);
      mkdirSync(dirname(cachePath), { recursive: true });
      writeFileSync(cachePath, "not valid json{{{");

      const cached = readVerdict({
        cache,
        targetPath,
        contentHash: "anyhash1",
        specPath: "roles/README.md",
      });

      expect(cached).toBeNull();
      expect(existsSync(cachePath)).toBe(false);
    });

    it("read() returns null for an unrecognized cache version", () => {
      const targetPath = join(projectRoot, "roles", "future.md");
      const cachePath = cache.pathFor(targetPath);
      mkdirSync(dirname(cachePath), { recursive: true });
      writeFileSync(cachePath, JSON.stringify({ version: "99.0", something: "else" }));

      const cached = readVerdict({
        cache,
        targetPath,
        contentHash: "anyhash1",
        specPath: "roles/README.md",
      });

      expect(cached).toBeNull();
    });

    it("write() replaces a corrupt cache file with a fresh v2.0 file", () => {
      const targetPath = join(projectRoot, "roles", "corrupt.md");
      const cachePath = cache.pathFor(targetPath);
      mkdirSync(dirname(cachePath), { recursive: true });
      writeFileSync(cachePath, "not valid json{{{");

      writeVerdict({
        cache,
        targetPath,
        contentHash: "newhash1",
        result: { compliant: true, issues: [], reason: "recovered" },
        specPath: "roles/README.md",
      });

      const cached = readVerdict({
        cache,
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
    const specPath = "roles/README.md";

    it("returns full cache data without hash validation", () => {
      const targetPath = join(projectRoot, "roles", "test-expert.md");
      writeVerdict({ cache, targetPath, contentHash: hash, result, specPath });
      const cached = readVerdictEntry({ cache, targetPath, specPath: specPath });

      expect(cached).not.toBeNull();
      expect(cached!.version).toBe("4.0");
      expect(cached!.content_hash).toBe(hash);
      expect(cached!.cached_at).toBeTruthy();
      expect(cached!.document.path).toBe(targetPath);
      expect(cached!.document.spec_path).toBe("roles/README.md");
      expect(cached!.result).toEqual(result);
    });

    it("returns first entry when specPath is omitted", () => {
      const targetPath = join(projectRoot, "roles", "test-expert.md");
      writeVerdict({ cache, targetPath, contentHash: hash, result, specPath });
      const cached = readVerdictEntry({ cache, targetPath });

      expect(cached).not.toBeNull();
      expect(cached!.result).toEqual(result);
    });

    it("returns null when no cache file exists", () => {
      const targetPath = join(projectRoot, "roles", "nonexistent.md");
      const cached = readVerdictEntry({ cache, targetPath });

      expect(cached).toBeNull();
    });

    it("returns data even when hash would not match read()", () => {
      const targetPath = join(projectRoot, "roles", "test-expert.md");
      writeVerdict({ cache, targetPath, contentHash: hash, result, specPath });

      const readResult = readVerdict({
        cache,
        targetPath,
        contentHash: "different",
        specPath,
      });
      expect(readResult).toBeNull();

      const rawResult = readVerdictEntry({ cache, targetPath, specPath: specPath });
      expect(rawResult).not.toBeNull();
      expect(rawResult!.content_hash).toBe(hash);
    });

    it("does not delete corrupt cache files", () => {
      const targetPath = join(projectRoot, "roles", "corrupt.md");
      const cachePath = cache.pathFor(targetPath);
      mkdirSync(dirname(cachePath), { recursive: true });
      writeFileSync(cachePath, "not valid json{{{");

      const cached = readVerdictEntry({ cache, targetPath });
      expect(cached).toBeNull();
      expect(existsSync(cachePath)).toBe(true);
    });
  });

  describe("text sanitization", () => {
    const specPath = "roles/README.md";

    it("strips control characters and double quotes from reason and issues", () => {
      const targetPath = join(projectRoot, "roles", "test-expert.md");
      const hash = "abcd1234";
      const result = {
        compliant: false,
        issues: ['issue with \x00 null byte and "quotes"'],
        reason: 'No \x01\x02\x03 — bad chars here\x00 and "quoted text"',
        severity: "error" as const,
      };

      writeVerdict({ cache, targetPath, contentHash: hash, result, specPath });
      const cached = readVerdict({
        cache,
        targetPath,
        contentHash: hash,
        specPath,
      });

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

      writeVerdict({ cache, targetPath, contentHash: hash, result, specPath });
      const cached = readVerdict({
        cache,
        targetPath,
        contentHash: hash,
        specPath,
      });

      expect(cached!.reason).toContain("\n");
      expect(cached!.reason).toContain("\t");
    });
  });
});
