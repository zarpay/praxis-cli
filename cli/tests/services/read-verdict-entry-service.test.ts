import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { VerdictCache } from "@/models/verdict-cache.js";
import readVerdictEntry from "@/services/read-verdict-entry-service.js";
import writeVerdict from "@/services/write-verdict-service.js";

describe("readVerdictEntry", () => {
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
  const hash = "abcd1234";
  const result = { compliant: true, issues: [], reason: "All good" };

  it("returns the full entry without hash validation, for reporting", () => {
    const targetPath = join(projectRoot, "roles", "test-expert.md");
    writeVerdict({ cache, targetPath, contentHash: hash, result, specPath });

    const cached = readVerdictEntry({ cache, targetPath, specPath });

    expect(cached).not.toBeNull();
    expect(cached!.version).toBe("4.0");
    expect(cached!.content_hash).toBe(hash);
    expect(cached!.cached_at).toBeTruthy();
    expect(cached!.document.path).toBe(targetPath);
    expect(cached!.document.spec_path).toBe(specPath);
    expect(cached!.result).toEqual(result);
  });

  it("returns the first entry when specPath is omitted", () => {
    const targetPath = join(projectRoot, "roles", "test-expert.md");
    writeVerdict({ cache, targetPath, contentHash: hash, result, specPath });

    expect(readVerdictEntry({ cache, targetPath })?.result).toEqual(result);
  });

  it("returns null when no cache file exists", () => {
    expect(
      readVerdictEntry({ cache, targetPath: join(projectRoot, "roles", "none.md") }),
    ).toBeNull();
  });

  it("still answers when the stored hash is stale — staleness is the reporter's call", () => {
    const targetPath = join(projectRoot, "roles", "test-expert.md");
    writeVerdict({ cache, targetPath, contentHash: hash, result, specPath });

    const entry = readVerdictEntry({ cache, targetPath, specPath });

    expect(entry!.content_hash).toBe(hash);
  });

  it("returns only the bound reviewer's entries", () => {
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

    writeVerdict({
      cache: cacheA,
      targetPath,
      contentHash: hash,
      result: { compliant: true, issues: [], reason: "reviewer A verdict" },
      specPath,
    });

    expect(readVerdictEntry({ cache: cacheB, targetPath })).toBeNull();
    expect(readVerdictEntry({ cache: cacheA, targetPath })?.result.reason).toBe(
      "reviewer A verdict",
    );
  });

  it("does not delete corrupt cache files — reporting must not destroy evidence", () => {
    const targetPath = join(projectRoot, "roles", "corrupt.md");
    const cachePath = cache.pathFor(targetPath);
    mkdirSync(join(cachePath, ".."), { recursive: true });
    writeFileSync(cachePath, "not valid json{{{");

    expect(readVerdictEntry({ cache, targetPath })).toBeNull();
    expect(existsSync(cachePath)).toBe(true);
  });
});
