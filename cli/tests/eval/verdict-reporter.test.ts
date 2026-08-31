import type { CacheFileData } from "@/types.js";

import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contentHash } from "@/eval/cache-manager.js";
import { assistHashInput, resolveAssistInputs } from "@/eval/judgment-input.js";
import { VerdictReporter } from "@/eval/verdict-reporter.js";

const DOC_CONTENT = "# Guide\nA target under report.";
const SPEC_CONTENT = "# Spec\nGuides need a title.";

describe("VerdictReporter", () => {
  let dir: string;
  let targetPath: string;
  let reporter: VerdictReporter;

  /** Cache data whose stored hash matches the on-disk target + spec. */
  function freshCacheData(overrides: Partial<CacheFileData["result"]> = {}): CacheFileData {
    return {
      version: "3.0",
      cached_at: "2026-08-31T12:00:00Z",
      content_hash: contentHash(DOC_CONTENT, SPEC_CONTENT),
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
    reporter = new VerdictReporter();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  describe("build()", () => {
    it("returns not_validated when no cache data exists", () => {
      const report = reporter.build(targetPath, null);

      expect(report).toMatchObject({ status: "not_validated", isStale: false, cacheData: null });
    });

    it("returns pass when the target and spec are unchanged since validation", () => {
      const report = reporter.build(targetPath, freshCacheData());

      expect(report).toMatchObject({ status: "pass", isStale: false });
    });

    it("returns stale when the target changed since validation", () => {
      writeFileSync(targetPath, "# Guide\nEdited since the verdict.");

      const report = reporter.build(targetPath, freshCacheData());

      expect(report).toMatchObject({ status: "stale", isStale: true });
    });

    it("returns stale when the spec changed since validation", () => {
      writeFileSync(join(dir, "README.md"), "# Spec\nStricter now.");

      const report = reporter.build(targetPath, freshCacheData());

      expect(report).toMatchObject({ status: "stale", isStale: true });
    });

    it("returns warn for a fresh non-compliant verdict with warning severity", () => {
      const cacheData = freshCacheData({
        compliant: false,
        issues: ["Minor issue"],
        severity: "warning",
      });

      const report = reporter.build(targetPath, cacheData);

      expect(report.status).toBe("warn");
    });

    it("returns fail for a fresh non-compliant verdict with error severity", () => {
      const cacheData = freshCacheData({
        compliant: false,
        issues: ["Major issue"],
        severity: "error",
      });

      const report = reporter.build(targetPath, cacheData);

      expect(report.status).toBe("fail");
    });

    it("skips the staleness check when the spec cannot be found", () => {
      rmSync(join(dir, "README.md"));
      const cacheData = {
        ...freshCacheData(),
        document: { ...freshCacheData().document, spec_path: join(dir, "missing.md") },
      };

      const report = reporter.build(targetPath, cacheData);

      expect(report).toMatchObject({ status: "pass", currentHash: null, isStale: false });
    });

    it("resolves the spec by a glob specFilePattern when the cache names none", () => {
      rmSync(join(dir, "README.md"));
      writeFileSync(join(dir, "rules.sme.md"), SPEC_CONTENT);
      const globReporter = new VerdictReporter({ specFilePattern: "*.sme.md" });

      const report = globReporter.build(targetPath, null);

      expect(report.currentHash).toBe(contentHash(DOC_CONTENT, SPEC_CONTENT));
    });

    it("returns a null hash when the target does not exist", () => {
      const report = reporter.build(join(dir, "missing.md"), null);

      expect(report.currentHash).toBeNull();
    });

    it("reports stale when a spec-declared context file changed since validation", () => {
      const specContent = ['---', 'context:', '  - "services/store.ts"', '---', '# Spec'].join(
        "\n",
      );
      writeFileSync(join(dir, "README.md"), specContent);
      mkdirSync(join(dir, "services"), { recursive: true });
      writeFileSync(join(dir, "services", "store.ts"), "STORE_V1");

      const rootReporter = new VerdictReporter({ root: dir });
      const specPath = join(dir, "README.md");
      const assist = resolveAssistInputs({ specContent, specPath, root: dir });
      const cacheData = {
        ...freshCacheData(),
        content_hash: contentHash(DOC_CONTENT, specContent, assistHashInput(assist)),
      };

      expect(rootReporter.build(targetPath, cacheData).status).toBe("pass");

      writeFileSync(join(dir, "services", "store.ts"), "STORE_V2");

      expect(rootReporter.build(targetPath, cacheData).status).toBe("stale");
    });

    it("skips the staleness check when a context-declaring spec has no root to resolve against", () => {
      const specContent = ['---', 'context:', '  - "services/store.ts"', '---', '# Spec'].join(
        "\n",
      );
      writeFileSync(join(dir, "README.md"), specContent);

      const report = reporter.build(targetPath, freshCacheData());

      expect(report).toMatchObject({ currentHash: null, isStale: false });
    });
  });

  describe("render()", () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    function output(): string {
      return consoleSpy.mock.calls.map((call) => call[0]).join("\n");
    }

    it("displays the not_validated state with run guidance", () => {
      reporter.render(reporter.build(targetPath, null), false);

      expect(output()).toContain("NOT VALIDATED");
    });

    it("names the eval command in the guidance, not the removed v1 verb", () => {
      reporter.render(reporter.build(targetPath, null), false);

      expect(output()).toContain("praxis eval run");
    });

    it("displays the pass state with the target's type and spec", () => {
      reporter.render(reporter.build(targetPath, freshCacheData()), false);

      expect(output()).toContain("Document is compliant");
    });

    it("displays a fail state's issues", () => {
      const cacheData = freshCacheData({
        compliant: false,
        issues: ["Missing owner field", "Missing Objective section"],
        severity: "error",
      });

      reporter.render(reporter.build(targetPath, cacheData), false);

      expect(output()).toContain("Missing owner field");
    });

    it("displays the staleness warning when the target changed", () => {
      writeFileSync(targetPath, "# Guide\nEdited since the verdict.");

      reporter.render(reporter.build(targetPath, freshCacheData()), false);

      expect(output()).toContain("Document has changed since last validation");
    });

    it("shows the AI reasoning only when verbose", () => {
      reporter.render(reporter.build(targetPath, freshCacheData()), true);

      expect(output()).toContain("AI Reasoning:");
    });

    it("hides the AI reasoning when not verbose", () => {
      reporter.render(reporter.build(targetPath, freshCacheData()), false);

      expect(output()).not.toContain("AI Reasoning:");
    });
  });
});
