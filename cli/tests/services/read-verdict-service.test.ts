import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { VerdictCache } from "@/models/verdict-cache.js";
import readVerdictService from "@/services/read-verdict-service.js";
import writeVerdictService from "@/services/write-verdict-service.js";

describe("readVerdictService", () => {
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

  const specPath = "roles/README.md";

  it("returns null when no cache entry exists", () => {
    const targetPath = join(projectRoot, "roles", "test-expert.md");

    expect(readVerdictService({ cache, targetPath, contentHash: "nonexist", specPath })).toBeNull();
  });

  it("returns null when the content hash does not match — editing invalidates", () => {
    const targetPath = join(projectRoot, "roles", "test-expert.md");
    writeVerdictService({
      cache,
      targetPath,
      contentHash: "abcd1234",
      result: { compliant: true, issues: [], reason: "ok" },
      specPath,
    });

    expect(
      readVerdictService({ cache, targetPath, contentHash: "different", specPath }),
    ).toBeNull();
  });

  it("returns null when the spec does not match any cached entry", () => {
    const targetPath = join(projectRoot, "docs", "guide.md");
    writeVerdictService({
      cache,
      targetPath,
      contentHash: "hash1",
      result: { compliant: true, issues: [], reason: "ok" },
      specPath: "specs/README.md",
    });

    expect(
      readVerdictService({
        cache,
        targetPath,
        contentHash: "hash1",
        specPath: "completely/different/README.md",
      }),
    ).toBeNull();
  });

  it("answers identically on repeated reads", () => {
    const targetPath = join(projectRoot, "docs", "guide.md");
    writeVerdictService({
      cache,
      targetPath,
      contentHash: "stablehash",
      result: { compliant: true, issues: [], reason: "ok" },
      specPath,
    });

    const first = readVerdictService({ cache, targetPath, contentHash: "stablehash", specPath });
    const second = readVerdictService({ cache, targetPath, contentHash: "stablehash", specPath });

    expect(first).toEqual(second);
    expect(first).not.toBeNull();
  });

  it("never returns another reviewer's verdict", () => {
    const cacheA = new VerdictCache({
      cacheRoot,
      projectRoot,
      reviewer: { name: "a", model: "m", hash: "aaaa1111" },
    });
    const cacheB = new VerdictCache({
      cacheRoot,
      projectRoot,
      reviewer: { name: "b", model: "m", hash: "bbbb2222" },
    });
    const targetPath = join(projectRoot, "roles", "shared.md");

    writeVerdictService({
      cache: cacheA,
      targetPath,
      contentHash: "hash1234",
      result: { compliant: true, issues: [], reason: "reviewer A verdict" },
      specPath,
    });

    expect(
      readVerdictService({ cache: cacheB, targetPath, contentHash: "hash1234", specPath }),
    ).toBeNull();
    expect(
      readVerdictService({ cache: cacheA, targetPath, contentHash: "hash1234", specPath })?.reason,
    ).toBe("reviewer A verdict");
  });

  it("deletes a corrupt cache file and returns null — a bad cache costs a re-review, never a crash", () => {
    const targetPath = join(projectRoot, "roles", "corrupt.md");
    const cachePath = cache.pathFor(targetPath);
    mkdirSync(join(cachePath, ".."), { recursive: true });
    writeFileSync(cachePath, "not valid json{{{");

    expect(readVerdictService({ cache, targetPath, contentHash: "anyhash1", specPath })).toBeNull();
    expect(existsSync(cachePath)).toBe(false);
  });

  it("returns null for an unrecognized cache version", () => {
    const targetPath = join(projectRoot, "roles", "future.md");
    const cachePath = cache.pathFor(targetPath);
    mkdirSync(join(cachePath, ".."), { recursive: true });
    writeFileSync(cachePath, JSON.stringify({ version: "99.0", something: "else" }));

    expect(readVerdictService({ cache, targetPath, contentHash: "anyhash1", specPath })).toBeNull();
  });
});
