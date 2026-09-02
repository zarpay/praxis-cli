import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PraxisConfig } from "@/models/praxis-config.js";
import { Reviewer } from "@/models/reviewer.js";
import { VerdictCache } from "@/models/verdict-cache.js";
import pruneCacheService from "@/services/prune-cache-service.js";
import readVerdictService from "@/services/read-verdict-service.js";
import writeVerdictService from "@/services/write-verdict-service.js";

const LIVE = { name: "live", model: "live-model", apiKeyEnvVar: "KEY" };
const RESULT = { compliant: true, issues: [], reason: "ok" };
const SPEC = "docs/README.md";

describe("pruneCacheService", () => {
  let root: string;
  let config: PraxisConfig;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-prune-test-${randomUUID()}`);
    mkdirSync(join(root, ".praxis"), { recursive: true });
    writeFileSync(join(root, ".praxis", "config.json"), JSON.stringify({ reviewers: [LIVE] }));
    config = new PraxisConfig(root);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /** A cache bound to the given reviewer identity. */
  function cacheFor(identity: { name: string; model: string; hash: string }): VerdictCache {
    return new VerdictCache({ projectRoot: root, reviewer: identity });
  }

  /** The live reviewer's true cache identity, hash and all. */
  function liveIdentity(): { name: string; model: string; hash: string } {
    return Reviewer.fromConfig(LIVE).cacheIdentity();
  }

  it("does nothing on a project with no cache", () => {
    expect(pruneCacheService({ root, config })).toEqual({ entriesPruned: 0, filesRemoved: 0 });
  });

  it("keeps entries whose reviewer is still configured", () => {
    const cache = cacheFor(liveIdentity());
    const targetPath = join(root, "docs", "guide.md");
    writeVerdictService({
      cache,
      targetPath,
      contentHash: "abcd1234",
      result: RESULT,
      specPath: SPEC,
    });

    const result = pruneCacheService({ root, config });

    expect(result).toEqual({ entriesPruned: 0, filesRemoved: 0 });
    expect(
      readVerdictService({ cache, targetPath, contentHash: "abcd1234", specPath: SPEC }),
    ).toEqual(RESULT);
  });

  it("drops an epoch-rolled entry but keeps the current one in the same file", () => {
    const targetPath = join(root, "docs", "guide.md");
    const stale = { name: "live", model: "live-model", hash: "0ldep0ch" };
    writeVerdictService({
      cache: cacheFor(stale),
      targetPath,
      contentHash: "aaaa1111",
      result: RESULT,
      specPath: SPEC,
    });
    writeVerdictService({
      cache: cacheFor(liveIdentity()),
      targetPath,
      contentHash: "bbbb2222",
      result: RESULT,
      specPath: SPEC,
    });

    const result = pruneCacheService({ root, config });

    expect(result).toEqual({ entriesPruned: 1, filesRemoved: 0 });
    expect(
      readVerdictService({
        cache: cacheFor(liveIdentity()),
        targetPath,
        contentHash: "bbbb2222",
        specPath: SPEC,
      }),
    ).toEqual(RESULT);
  });

  it("deletes a file once nothing in it survives", () => {
    const targetPath = join(root, "docs", "gone.md");
    const retired = { name: "retired", model: "old-model", hash: "deadbeef" };
    const cache = cacheFor(retired);
    writeVerdictService({
      cache,
      targetPath,
      contentHash: "aaaa1111",
      result: RESULT,
      specPath: SPEC,
    });

    const result = pruneCacheService({ root, config });

    expect(result).toEqual({ entriesPruned: 1, filesRemoved: 1 });
    expect(existsSync(cache.pathFor(targetPath))).toBe(false);
  });

  it("removes unreadable and outdated-format files whole", () => {
    const cacheRoot = new VerdictCache({ projectRoot: root }).root;
    const corrupt = join(cacheRoot, "docs", "corrupt.json");
    const outdated = join(cacheRoot, "docs", "outdated.json");
    mkdirSync(dirname(corrupt), { recursive: true });
    writeFileSync(corrupt, "not json{{{");
    writeFileSync(outdated, JSON.stringify({ version: "3.0", verdicts: {} }));

    const result = pruneCacheService({ root, config });

    expect(result).toEqual({ entriesPruned: 0, filesRemoved: 2 });
    expect(existsSync(corrupt)).toBe(false);
    expect(existsSync(outdated)).toBe(false);
  });
});
