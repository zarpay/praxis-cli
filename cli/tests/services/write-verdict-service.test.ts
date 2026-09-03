import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { VerdictCache } from "@/models/verdict-cache.js";
import readVerdictService from "@/services/read-verdict-service.js";
import writeVerdictService from "@/services/write-verdict-service.js";

describe("writeVerdictService", () => {
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

  it("writes a verdict that reads back exactly", () => {
    const targetPath = join(projectRoot, "roles", "test-expert.md");
    const result = { compliant: true, issues: [], reason: "All good" };

    writeVerdictService({ cache, targetPath, contentHash: hash, result, specPath });

    expect(readVerdictService({ cache, targetPath, contentHash: hash, specPath })).toEqual(result);
  });

  it("preserves the severity field through serialization", () => {
    const targetPath = join(projectRoot, "roles", "test-expert.md");
    const result = {
      compliant: false,
      issues: [{ text: "Missing section", axiomId: null, axiomVersion: null }],
      reason: "No — missing required section",
      severity: "error" as const,
    };

    writeVerdictService({ cache, targetPath, contentHash: hash, result, specPath });

    const cached = readVerdictService({ cache, targetPath, contentHash: hash, specPath });

    expect(cached?.severity).toBe("error");
  });

  it("caches two specs' verdicts on one document independently", () => {
    const targetPath = join(projectRoot, "docs", "guide.md");
    const passA = { compliant: true, issues: [], reason: "Pass spec A" };
    const failB = {
      compliant: false,
      issues: [{ text: "Missing section", axiomId: null, axiomVersion: null }],
      reason: "Fail spec B",
      severity: "error" as const,
    };

    writeVerdictService({
      cache,
      targetPath,
      contentHash: "hash1",
      result: passA,
      specPath: "specs/README.md",
    });
    writeVerdictService({
      cache,
      targetPath,
      contentHash: "hash2",
      result: failB,
      specPath: "other/README.md",
    });

    expect(
      readVerdictService({ cache, targetPath, contentHash: "hash1", specPath: "specs/README.md" }),
    ).toEqual(passA);
    expect(
      readVerdictService({ cache, targetPath, contentHash: "hash2", specPath: "other/README.md" }),
    ).toEqual(failB);
  });

  it("preserves another reviewer's verdict when writing its own", () => {
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
      contentHash: hash,
      result: { compliant: true, issues: [], reason: "reviewer A verdict" },
      specPath,
    });
    writeVerdictService({
      cache: cacheB,
      targetPath,
      contentHash: hash,
      result: { compliant: true, issues: [], reason: "reviewer B verdict" },
      specPath,
    });

    const fromA = readVerdictService({ cache: cacheA, targetPath, contentHash: hash, specPath });

    expect(fromA?.reason).toBe("reviewer A verdict");
  });

  it("replaces a corrupt cache file with a fresh one", () => {
    const targetPath = join(projectRoot, "roles", "corrupt.md");
    const cachePath = cache.pathFor(targetPath);
    mkdirSync(join(cachePath, ".."), { recursive: true });
    writeFileSync(cachePath, "not valid json{{{");

    writeVerdictService({
      cache,
      targetPath,
      contentHash: "newhash1",
      result: { compliant: true, issues: [], reason: "recovered" },
      specPath,
    });

    const cached = readVerdictService({ cache, targetPath, contentHash: "newhash1", specPath });

    expect(cached?.reason).toBe("recovered");
  });

  describe("text sanitization", () => {
    it("strips control characters and double quotes from reason and issues", () => {
      const targetPath = join(projectRoot, "roles", "test-expert.md");
      const result = {
        compliant: false,
        issues: [
          { text: 'issue with \x00 null byte and "quotes"', axiomId: null, axiomVersion: null },
        ],
        reason: 'No \x01\x02\x03 — bad chars here\x00 and "quoted text"',
        severity: "error" as const,
      };

      writeVerdictService({ cache, targetPath, contentHash: hash, result, specPath });

      const cached = readVerdictService({ cache, targetPath, contentHash: hash, specPath });

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
      const result = { compliant: true, issues: [], reason: "Yes\n\tAll good\nNo issues" };

      writeVerdictService({ cache, targetPath, contentHash: hash, result, specPath });

      const cached = readVerdictService({ cache, targetPath, contentHash: hash, specPath });

      expect(cached!.reason).toContain("\n");
      expect(cached!.reason).toContain("\t");
    });
  });
});
