import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Reviewer } from "@/models/reviewer.js";
import { VerdictStore } from "@/stores/verdict-store.js";
import { testConfig } from "@tests/helpers/test-config.js";

describe("VerdictStore", () => {
  let projectRoot: string;
  let cacheRoot: string;
  let cache: VerdictStore;

  beforeEach(() => {
    projectRoot = join(tmpdir(), `praxis-cache-test-${randomUUID()}`);
    mkdirSync(projectRoot, { recursive: true });
    cacheRoot = join(projectRoot, ".praxis", "cache", "validation");
    cache = new VerdictStore(testConfig(projectRoot));
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  describe("addressing", () => {
    it("defaults its root to .praxis/cache/validation under the project root", () => {
      const bare = new VerdictStore(testConfig("/project"));

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
        const a = new VerdictStore(testConfig(projectRoot), {
          reviewer: { name: "a", model: "m", hash: "aaaa1111" },
        });
        const b = new VerdictStore(testConfig(projectRoot), {
          reviewer: { name: "b", model: "m", hash: "bbbb2222" },
        });
        const targetPath = join(projectRoot, "roles", "shared.md");

        // One artifact per target — every reviewer's verdicts land in it.
        expect(a.pathFor(targetPath)).toBe(b.pathFor(targetPath));
      });
    });

    describe("keyFor", () => {
      it("keys an entry on the spec and the bound reviewer's hash", () => {
        const a = new VerdictStore(testConfig(projectRoot), {
          reviewer: { name: "a", model: "m", hash: "aaaa1111" },
        });
        const b = new VerdictStore(testConfig(projectRoot), {
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

  describe("readVerdict", () => {
    const specPath = "roles/README.md";

    it("returns null when no cache entry exists", () => {
      const targetPath = join(projectRoot, "roles", "test-expert.md");

      expect(cache.readVerdict({ targetPath, contentHash: "nonexist", specPath })).toBeNull();
    });

    it("returns null when the content hash does not match — editing invalidates", () => {
      const targetPath = join(projectRoot, "roles", "test-expert.md");
      cache.writeVerdict({
        targetPath,
        contentHash: "abcd1234",
        result: { compliant: true, issues: [], reason: "ok" },
        specPath,
      });

      expect(cache.readVerdict({ targetPath, contentHash: "different", specPath })).toBeNull();
    });

    it("returns null when the spec does not match any cached entry", () => {
      const targetPath = join(projectRoot, "docs", "guide.md");
      cache.writeVerdict({
        targetPath,
        contentHash: "hash1",
        result: { compliant: true, issues: [], reason: "ok" },
        specPath: "specs/README.md",
      });

      expect(
        cache.readVerdict({
          targetPath,
          contentHash: "hash1",
          specPath: "completely/different/README.md",
        }),
      ).toBeNull();
    });

    it("answers identically on repeated reads", () => {
      const targetPath = join(projectRoot, "docs", "guide.md");
      cache.writeVerdict({
        targetPath,
        contentHash: "stablehash",
        result: { compliant: true, issues: [], reason: "ok" },
        specPath,
      });

      const first = cache.readVerdict({ targetPath, contentHash: "stablehash", specPath });
      const second = cache.readVerdict({ targetPath, contentHash: "stablehash", specPath });

      expect(first).toEqual(second);
      expect(first).not.toBeNull();
    });

    it("never returns another reviewer's verdict", () => {
      const cacheA = new VerdictStore(testConfig(projectRoot), {
        reviewer: { name: "a", model: "m", hash: "aaaa1111" },
      });
      const cacheB = new VerdictStore(testConfig(projectRoot), {
        reviewer: { name: "b", model: "m", hash: "bbbb2222" },
      });
      const targetPath = join(projectRoot, "roles", "shared.md");

      cacheA.writeVerdict({
        targetPath,
        contentHash: "hash1234",
        result: { compliant: true, issues: [], reason: "reviewer A verdict" },
        specPath,
      });

      expect(cacheB.readVerdict({ targetPath, contentHash: "hash1234", specPath })).toBeNull();
      expect(cacheA.readVerdict({ targetPath, contentHash: "hash1234", specPath })?.reason).toBe(
        "reviewer A verdict",
      );
    });

    it("deletes a corrupt cache file and returns null — a bad cache costs a re-review, never a crash", () => {
      const targetPath = join(projectRoot, "roles", "corrupt.md");
      const cachePath = cache.pathFor(targetPath);
      mkdirSync(join(cachePath, ".."), { recursive: true });
      writeFileSync(cachePath, "not valid json{{{");

      expect(cache.readVerdict({ targetPath, contentHash: "anyhash1", specPath })).toBeNull();
      expect(existsSync(cachePath)).toBe(false);
    });

    it("returns null for an unrecognized cache version", () => {
      const targetPath = join(projectRoot, "roles", "future.md");
      const cachePath = cache.pathFor(targetPath);
      mkdirSync(join(cachePath, ".."), { recursive: true });
      writeFileSync(cachePath, JSON.stringify({ version: "99.0", something: "else" }));

      expect(cache.readVerdict({ targetPath, contentHash: "anyhash1", specPath })).toBeNull();
    });
  });

  describe("writeVerdict", () => {
    const specPath = "roles/README.md";
    const hash = "abcd1234";

    it("writes a verdict that reads back exactly", () => {
      const targetPath = join(projectRoot, "roles", "test-expert.md");
      const result = { compliant: true, issues: [], reason: "All good" };

      cache.writeVerdict({ targetPath, contentHash: hash, result, specPath });

      expect(cache.readVerdict({ targetPath, contentHash: hash, specPath })).toEqual(result);
    });

    it("preserves the severity field through serialization", () => {
      const targetPath = join(projectRoot, "roles", "test-expert.md");
      const result = {
        compliant: false,
        issues: [{ text: "Missing section", axiomId: null, axiomVersion: null }],
        reason: "No — missing required section",
        severity: "error" as const,
      };

      cache.writeVerdict({ targetPath, contentHash: hash, result, specPath });

      const cached = cache.readVerdict({ targetPath, contentHash: hash, specPath });

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

      cache.writeVerdict({
        targetPath,
        contentHash: "hash1",
        result: passA,
        specPath: "specs/README.md",
      });
      cache.writeVerdict({
        targetPath,
        contentHash: "hash2",
        result: failB,
        specPath: "other/README.md",
      });

      expect(
        cache.readVerdict({ targetPath, contentHash: "hash1", specPath: "specs/README.md" }),
      ).toEqual(passA);
      expect(
        cache.readVerdict({ targetPath, contentHash: "hash2", specPath: "other/README.md" }),
      ).toEqual(failB);
    });

    it("preserves another reviewer's verdict when writing its own", () => {
      const cacheA = new VerdictStore(testConfig(projectRoot), {
        reviewer: { name: "a", model: "m", hash: "aaaa1111" },
      });
      const cacheB = new VerdictStore(testConfig(projectRoot), {
        reviewer: { name: "b", model: "m", hash: "bbbb2222" },
      });
      const targetPath = join(projectRoot, "roles", "shared.md");

      cacheA.writeVerdict({
        targetPath,
        contentHash: hash,
        result: { compliant: true, issues: [], reason: "reviewer A verdict" },
        specPath,
      });
      cacheB.writeVerdict({
        targetPath,
        contentHash: hash,
        result: { compliant: true, issues: [], reason: "reviewer B verdict" },
        specPath,
      });

      const fromA = cacheA.readVerdict({ targetPath, contentHash: hash, specPath });

      expect(fromA?.reason).toBe("reviewer A verdict");
    });

    it("replaces a corrupt cache file with a fresh one", () => {
      const targetPath = join(projectRoot, "roles", "corrupt.md");
      const cachePath = cache.pathFor(targetPath);
      mkdirSync(join(cachePath, ".."), { recursive: true });
      writeFileSync(cachePath, "not valid json{{{");

      cache.writeVerdict({
        targetPath,
        contentHash: "newhash1",
        result: { compliant: true, issues: [], reason: "recovered" },
        specPath,
      });

      const cached = cache.readVerdict({ targetPath, contentHash: "newhash1", specPath });

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

        cache.writeVerdict({ targetPath, contentHash: hash, result, specPath });

        const cached = cache.readVerdict({ targetPath, contentHash: hash, specPath });

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

        cache.writeVerdict({ targetPath, contentHash: hash, result, specPath });

        const cached = cache.readVerdict({ targetPath, contentHash: hash, specPath });

        expect(cached!.reason).toContain("\n");
        expect(cached!.reason).toContain("\t");
      });
    });
  });

  describe("readEntry", () => {
    const specPath = "roles/README.md";
    const hash = "abcd1234";
    const result = { compliant: true, issues: [], reason: "All good" };

    it("returns the full entry without hash validation, for reporting", () => {
      const targetPath = join(projectRoot, "roles", "test-expert.md");
      cache.writeVerdict({ targetPath, contentHash: hash, result, specPath });

      const cached = cache.readEntry({ targetPath, specPath });

      expect(cached).not.toBeNull();
      expect(cached!.version).toBe("5.0");
      expect(cached!.content_hash).toBe(hash);
      expect(cached!.cached_at).toBeTruthy();
      expect(cached!.document.path).toBe(targetPath);
      expect(cached!.document.spec_path).toBe(specPath);
      expect(cached!.result).toEqual(result);
    });

    it("returns the first entry when specPath is omitted", () => {
      const targetPath = join(projectRoot, "roles", "test-expert.md");
      cache.writeVerdict({ targetPath, contentHash: hash, result, specPath });

      expect(cache.readEntry({ targetPath })?.result).toEqual(result);
    });

    it("returns null when no cache file exists", () => {
      expect(cache.readEntry({ targetPath: join(projectRoot, "roles", "none.md") })).toBeNull();
    });

    it("still answers when the stored hash is stale — staleness is the reporter's call", () => {
      const targetPath = join(projectRoot, "roles", "test-expert.md");
      cache.writeVerdict({ targetPath, contentHash: hash, result, specPath });

      const entry = cache.readEntry({ targetPath, specPath });

      expect(entry!.content_hash).toBe(hash);
    });

    it("returns only the bound reviewer's entries", () => {
      const cacheA = new VerdictStore(testConfig(projectRoot), {
        reviewer: { name: "a", model: "m", hash: "aaaa1111" },
      });
      const cacheB = new VerdictStore(testConfig(projectRoot), {
        reviewer: { name: "b", model: "m", hash: "bbbb2222" },
      });
      const targetPath = join(projectRoot, "roles", "shared.md");

      cacheA.writeVerdict({
        targetPath,
        contentHash: hash,
        result: { compliant: true, issues: [], reason: "reviewer A verdict" },
        specPath,
      });

      expect(cacheB.readEntry({ targetPath })).toBeNull();
      expect(cacheA.readEntry({ targetPath })?.result.reason).toBe("reviewer A verdict");
    });

    it("does not delete corrupt cache files — reporting must not destroy evidence", () => {
      const targetPath = join(projectRoot, "roles", "corrupt.md");
      const cachePath = cache.pathFor(targetPath);
      mkdirSync(join(cachePath, ".."), { recursive: true });
      writeFileSync(cachePath, "not valid json{{{");

      expect(cache.readEntry({ targetPath })).toBeNull();
      expect(existsSync(cachePath)).toBe(true);
    });
  });

  describe("prune", () => {
    const LIVE = { name: "live", model: "live-model", apiKeyEnvVar: "KEY" };
    const RESULT = { compliant: true, issues: [], reason: "ok" };
    const SPEC = "docs/README.md";

    /** A cache bound to the given reviewer identity. */
    function cacheFor(identity: { name: string; model: string; hash: string }): VerdictStore {
      return new VerdictStore(testConfig(projectRoot), { reviewer: identity });
    }

    /** The live reviewer's true cache identity, hash and all. */
    function liveIdentity(): { name: string; model: string; hash: string } {
      return Reviewer.fromConfig(LIVE).cacheIdentity();
    }

    /** The behavioral hashes a prune keeps. */
    function liveHashes(): Set<string> {
      return new Set([liveIdentity().hash]);
    }

    it("does nothing on a project with no cache", () => {
      expect(cache.prune(liveHashes())).toEqual({ entriesPruned: 0, filesRemoved: 0 });
    });

    it("keeps entries whose reviewer hash is live", () => {
      const store = cacheFor(liveIdentity());
      const targetPath = join(projectRoot, "docs", "guide.md");
      store.writeVerdict({ targetPath, contentHash: "abcd1234", result: RESULT, specPath: SPEC });

      const result = store.prune(liveHashes());

      expect(result).toEqual({ entriesPruned: 0, filesRemoved: 0 });
      expect(store.readVerdict({ targetPath, contentHash: "abcd1234", specPath: SPEC })).toEqual(
        RESULT,
      );
    });

    it("drops an epoch-rolled entry but keeps the current one in the same file", () => {
      const targetPath = join(projectRoot, "docs", "guide.md");
      const stale = { name: "live", model: "live-model", hash: "0ldep0ch" };
      cacheFor(stale).writeVerdict({
        targetPath,
        contentHash: "aaaa1111",
        result: RESULT,
        specPath: SPEC,
      });
      const store = cacheFor(liveIdentity());
      store.writeVerdict({ targetPath, contentHash: "bbbb2222", result: RESULT, specPath: SPEC });

      const result = store.prune(liveHashes());

      expect(result).toEqual({ entriesPruned: 1, filesRemoved: 0 });
      expect(store.readVerdict({ targetPath, contentHash: "bbbb2222", specPath: SPEC })).toEqual(
        RESULT,
      );
    });

    it("deletes a file once nothing in it survives", () => {
      const targetPath = join(projectRoot, "docs", "gone.md");
      const retired = { name: "retired", model: "old-model", hash: "deadbeef" };
      const store = cacheFor(retired);
      store.writeVerdict({ targetPath, contentHash: "aaaa1111", result: RESULT, specPath: SPEC });

      const result = store.prune(liveHashes());

      expect(result).toEqual({ entriesPruned: 1, filesRemoved: 1 });
      expect(existsSync(store.pathFor(targetPath))).toBe(false);
    });

    it("removes unreadable and outdated-format files whole", () => {
      const corrupt = join(cacheRoot, "docs", "corrupt.json");
      const outdated = join(cacheRoot, "docs", "outdated.json");
      mkdirSync(join(cacheRoot, "docs"), { recursive: true });
      writeFileSync(corrupt, "not json{{{");
      writeFileSync(outdated, JSON.stringify({ version: "3.0", verdicts: {} }));

      const result = cache.prune(liveHashes());

      expect(result).toEqual({ entriesPruned: 0, filesRemoved: 2 });
      expect(existsSync(corrupt)).toBe(false);
      expect(existsSync(outdated)).toBe(false);
    });
  });
});
