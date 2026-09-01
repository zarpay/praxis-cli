import type { CacheReviewerIdentity, VerdictEntry } from "@/domains/eval/types.js";

import { describe, expect, it } from "vitest";

import { CACHE_VERSION, VerdictCacheFile } from "@/domains/eval/models/verdict-cache-file.js";

const FLASH: CacheReviewerIdentity = { name: "flash", model: "m", hash: "aaaa1111" };
const V32: CacheReviewerIdentity = { name: "v32", model: "m", hash: "bbbb2222" };

/** An entry from one reviewer about one spec. */
function entry(reviewer: CacheReviewerIdentity, specPath = "src/README.md"): VerdictEntry {
  return {
    reviewer,
    spec_path: specPath,
    cached_at: "2026-09-01T00:00:00.000Z",
    content_hash: "deadbeef",
    result: { compliant: true, issues: [], reason: "Fine." },
  };
}

describe("VerdictCacheFile", () => {
  describe("keys", () => {
    it("keys an entry on both spec and reviewer", () => {
      const forFlash = VerdictCacheFile.keyFor("src/README.md", FLASH.hash);
      const forV32 = VerdictCacheFile.keyFor("src/README.md", V32.hash);

      expect(forFlash).not.toBe(forV32);
    });

    it("gives different specs different keys for one reviewer", () => {
      const src = VerdictCacheFile.keyFor("src/README.md", FLASH.hash);
      const tests = VerdictCacheFile.keyFor("tests/README.md", FLASH.hash);

      expect(src).not.toBe(tests);
    });

    it("recomputes an entry's key from its stored fields", () => {
      const stored = entry(FLASH, "src/README.md");

      expect(VerdictCacheFile.keyOf(stored)).toBe(
        VerdictCacheFile.keyFor("src/README.md", FLASH.hash),
      );
    });
  });

  describe("entries", () => {
    it("returns only the asked-for reviewer's entries", () => {
      const file = VerdictCacheFile.empty();
      file.put(VerdictCacheFile.keyOf(entry(FLASH)), entry(FLASH));
      file.put(VerdictCacheFile.keyOf(entry(V32)), entry(V32));

      expect(file.entriesFor(FLASH).map((e) => e.reviewer.name)).toEqual(["flash"]);
    });

    it("keeps one reviewer's write from touching another's", () => {
      const file = VerdictCacheFile.empty();
      file.put(VerdictCacheFile.keyOf(entry(FLASH)), entry(FLASH));
      file.put(VerdictCacheFile.keyOf(entry(V32)), entry(V32));

      expect(file.entriesFor(V32)).toHaveLength(1);
    });

    it("returns nothing for a reviewer with no entries", () => {
      expect(VerdictCacheFile.empty().entriesFor(FLASH)).toEqual([]);
    });
  });

  describe("parse()", () => {
    it("round-trips through toJson", () => {
      const file = VerdictCacheFile.empty();
      file.put(VerdictCacheFile.keyOf(entry(FLASH)), entry(FLASH));

      const reparsed = VerdictCacheFile.parse(file.toJson());

      expect(reparsed?.entriesFor(FLASH)).toHaveLength(1);
    });

    it("stamps the current version", () => {
      expect(JSON.parse(VerdictCacheFile.empty().toJson())).toMatchObject({
        version: CACHE_VERSION,
      });
    });

    it("reads an older format as nothing rather than raising", () => {
      const old = JSON.stringify({ version: "3.0", verdicts: { k: entry(FLASH) } });

      expect(VerdictCacheFile.parse(old)).toBeNull();
    });

    it("raises on text that is not JSON, so the caller can discard the file", () => {
      expect(() => VerdictCacheFile.parse("{ not json")).toThrow();
    });
  });
});
