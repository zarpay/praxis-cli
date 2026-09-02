import type { CacheFileData, VerdictReport } from "@/eval/types.js";

import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ReviewSubject } from "@/eval/models/review-subject.js";
import buildVerdictReport from "@/eval/services/build-verdict-report-service.js";

const DOC_CONTENT = "# Guide\nA target under report.";
const SPEC_CONTENT = "# Spec\nGuides need a title.";

describe("buildVerdictReport", () => {
  let dir: string;
  let targetPath: string;
  let build: (cacheData: CacheFileData | null, specFilePattern?: string) => VerdictReport;
  /** The hash of the target and spec as first written, before a test edits them. */
  let baselineHash: string;

  /** Cache data whose stored hash matches the on-disk target + spec. */
  function freshCacheData(overrides: Partial<CacheFileData["result"]> = {}): CacheFileData {
    return {
      version: "4.0",
      cached_at: "2026-08-31T12:00:00Z",
      content_hash: baselineHash,
      document: { path: targetPath, spec_path: join(dir, "README.md") },
      result: { compliant: true, issues: [], reason: "All good", ...overrides },
    };
  }

  beforeEach(() => {
    dir = join(tmpdir(), `praxis-reporter-test-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    targetPath = join(dir, "guide.md");
    writeFileSync(targetPath, DOC_CONTENT);
    writeFileSync(join(dir, "README.md"), SPEC_CONTENT);
    baselineHash = ReviewSubject.resolve({
      targetPath,
      specPath: join(dir, "README.md"),
      root: dir,
    }).contentHash();
    build = (cacheData, specFilePattern = "README.md") =>
      buildVerdictReport({ targetPath, cacheData, specFilePattern, root: dir });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  describe("status", () => {
    it("returns not_validated when no cache data exists", () => {
      const report = build(null);

      expect(report).toMatchObject({ status: "not_validated", isStale: false, cacheData: null });
    });

    it("returns pass when the target and spec are unchanged since validation", () => {
      const report = build(freshCacheData());

      expect(report).toMatchObject({ status: "pass", isStale: false });
    });

    it("returns stale when the target changed since validation", () => {
      writeFileSync(targetPath, "# Guide\nEdited since the verdict.");

      const report = build(freshCacheData());

      expect(report).toMatchObject({ status: "stale", isStale: true });
    });

    it("returns stale when the spec changed since validation", () => {
      writeFileSync(join(dir, "README.md"), "# Spec\nStricter now.");

      const report = build(freshCacheData());

      expect(report).toMatchObject({ status: "stale", isStale: true });
    });

    it("returns warn for a fresh non-compliant verdict with warning severity", () => {
      const cacheData = freshCacheData({
        compliant: false,
        issues: ["Minor issue"],
        severity: "warning",
      });

      const report = build(cacheData);

      expect(report.status).toBe("warn");
    });

    it("returns fail for a fresh non-compliant verdict with error severity", () => {
      const cacheData = freshCacheData({
        compliant: false,
        issues: ["Major issue"],
        severity: "error",
      });

      const report = build(cacheData);

      expect(report.status).toBe("fail");
    });

    it("skips the staleness check when the spec cannot be found", () => {
      rmSync(join(dir, "README.md"));
      const cacheData = {
        ...freshCacheData(),
        document: { ...freshCacheData().document, spec_path: join(dir, "missing.md") },
      };

      const report = build(cacheData);

      expect(report).toMatchObject({ status: "pass", currentHash: null, isStale: false });
    });

    it("resolves the spec by a glob specFilePattern when the cache names none", () => {
      rmSync(join(dir, "README.md"));
      writeFileSync(join(dir, "rules.sme.md"), SPEC_CONTENT);
      const report = build(null, "*.sme.md");

      expect(report.currentHash).toBe(baselineHash);
    });

    it("returns a null hash when the target does not exist", () => {
      const report = buildVerdictReport({
        targetPath: join(dir, "missing.md"),
        cacheData: null,
        specFilePattern: "README.md",
        root: dir,
      });

      expect(report.currentHash).toBeNull();
    });

    it("reports stale when a spec-declared context file changed since validation", () => {
      const specContent = ["---", "context:", '  - "services/store.ts"', "---", "# Spec"].join(
        "\n",
      );
      writeFileSync(join(dir, "README.md"), specContent);
      mkdirSync(join(dir, "services"), { recursive: true });
      writeFileSync(join(dir, "services", "store.ts"), "STORE_V1");

      // Re-hash after the context file exists: this is what a run would key on.
      const cacheData = {
        ...freshCacheData(),
        content_hash: ReviewSubject.resolve({
          targetPath,
          specPath: join(dir, "README.md"),
          root: dir,
        }).contentHash(),
      };

      expect(build(cacheData).status).toBe("pass");

      writeFileSync(join(dir, "services", "store.ts"), "STORE_V2");

      expect(build(cacheData).status).toBe("stale");
    });

    it("skips the staleness check when a context-declaring spec has no root to resolve against", () => {
      const specContent = ["---", "context:", '  - "services/store.ts"', "---", "# Spec"].join(
        "\n",
      );
      writeFileSync(join(dir, "README.md"), specContent);

      // No root at all: the spec's context glob cannot be resolved.
      const report = buildVerdictReport({
        targetPath,
        cacheData: freshCacheData(),
        specFilePattern: "README.md",
      });

      expect(report).toMatchObject({ currentHash: null, isStale: false });
    });
  });
});
