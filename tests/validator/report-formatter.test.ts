import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CacheFileData } from "@/validator/cache-manager.js";
import { contentHash } from "@/validator/cache-manager.js";
import { buildReport, computeCurrentHash, displayReport } from "@/validator/report-formatter.js";

const baseCacheData: CacheFileData = {
  version: "1.0",
  cached_at: "2026-02-20T12:00:00Z",
  content_hash: "abcd1234",
  document: {
    path: "/project/roles/test.md",
    type: "role",
    spec_path: "/project/roles/README.md",
  },
  result: {
    compliant: true,
    issues: [],
    reason: "Yes -- all good",
  },
};

describe("buildReport()", () => {
  it("returns not_validated when cacheData is null", () => {
    const report = buildReport("/project/roles/test.md", null, "abcd1234");

    expect(report.status).toBe("not_validated");
    expect(report.isStale).toBe(false);
    expect(report.cacheData).toBeNull();
  });

  it("returns pass when compliant and hash matches", () => {
    const report = buildReport("/project/roles/test.md", baseCacheData, "abcd1234");

    expect(report.status).toBe("pass");
    expect(report.isStale).toBe(false);
  });

  it("returns stale when hash does not match", () => {
    const report = buildReport("/project/roles/test.md", baseCacheData, "different");

    expect(report.status).toBe("stale");
    expect(report.isStale).toBe(true);
  });

  it("returns warn for non-compliant with severity warning", () => {
    const warnData: CacheFileData = {
      ...baseCacheData,
      result: {
        compliant: false,
        issues: ["Minor issue"],
        reason: "Maybe -- minor issue",
        severity: "warning",
      },
    };
    const report = buildReport("/project/roles/test.md", warnData, "abcd1234");

    expect(report.status).toBe("warn");
  });

  it("returns fail for non-compliant with severity error", () => {
    const failData: CacheFileData = {
      ...baseCacheData,
      result: {
        compliant: false,
        issues: ["Major issue"],
        reason: "No -- major issue",
        severity: "error",
      },
    };
    const report = buildReport("/project/roles/test.md", failData, "abcd1234");

    expect(report.status).toBe("fail");
  });

  it("staleness takes priority over cached status", () => {
    const report = buildReport("/project/roles/test.md", baseCacheData, "newHash1");

    expect(report.status).toBe("stale");
  });

  it("skips staleness check when currentHash is null", () => {
    const report = buildReport("/project/roles/test.md", baseCacheData, null);

    expect(report.status).toBe("pass");
    expect(report.isStale).toBe(false);
  });
});

describe("displayReport()", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  function getOutput(): string {
    return consoleSpy.mock.calls.map((c) => c[0]).join("\n");
  }

  it("displays not_validated state with guidance", () => {
    const report = buildReport("/project/roles/test.md", null, null);

    displayReport(report, false);

    const output = getOutput();
    expect(output).toContain("NOT VALIDATED");
    expect(output).toContain("praxis validate document");
  });

  it("displays pass state", () => {
    const report = buildReport("/project/roles/test.md", baseCacheData, "abcd1234");

    displayReport(report, false);

    const output = getOutput();
    expect(output).toContain("PASS");
    expect(output).toContain("Document is compliant");
    expect(output).toContain("role");
  });

  it("displays fail state with issues", () => {
    const failData: CacheFileData = {
      ...baseCacheData,
      result: {
        compliant: false,
        issues: ["Missing owner field", "Missing Objective section"],
        reason: "No -- major issues",
        severity: "error",
      },
    };
    const report = buildReport("/project/roles/test.md", failData, "abcd1234");

    displayReport(report, false);

    const output = getOutput();
    expect(output).toContain("FAIL");
    expect(output).toContain("Missing owner field");
    expect(output).toContain("Missing Objective section");
  });

  it("displays stale warning", () => {
    const report = buildReport("/project/roles/test.md", baseCacheData, "different");

    displayReport(report, false);

    const output = getOutput();
    expect(output).toContain("STALE");
    expect(output).toContain("Document has changed since last validation");
  });

  it("shows AI reasoning when verbose is true", () => {
    const report = buildReport("/project/roles/test.md", baseCacheData, "abcd1234");

    displayReport(report, true);

    const output = getOutput();
    expect(output).toContain("AI Reasoning:");
    expect(output).toContain("Yes -- all good");
  });

  it("hides AI reasoning when verbose is false", () => {
    const report = buildReport("/project/roles/test.md", baseCacheData, "abcd1234");

    displayReport(report, false);

    const output = getOutput();
    expect(output).not.toContain("AI Reasoning:");
  });
});

describe("computeCurrentHash()", () => {
  let dir: string;

  beforeEach(() => {
    dir = join(tmpdir(), `praxis-report-test-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("hashes document plus explicitly provided spec", () => {
    const docPath = join(dir, "doc.md");
    const specPath = join(dir, "SPEC.md");
    writeFileSync(docPath, "# Doc");
    writeFileSync(specPath, "# Spec");

    expect(computeCurrentHash(docPath, specPath)).toBe(contentHash("# Doc", "# Spec"));
  });

  it("auto-detects a sibling README.md when no spec is provided", () => {
    const docPath = join(dir, "doc.md");
    writeFileSync(docPath, "# Doc");
    writeFileSync(join(dir, "README.md"), "# Readme spec");

    expect(computeCurrentHash(docPath)).toBe(contentHash("# Doc", "# Readme spec"));
  });

  it("finds the spec via a glob specFilePattern", () => {
    const docPath = join(dir, "doc.md");
    writeFileSync(docPath, "# Doc");
    writeFileSync(join(dir, "rules.sme.md"), "# SME spec");

    expect(computeCurrentHash(docPath, undefined, "*.sme.md")).toBe(
      contentHash("# Doc", "# SME spec"),
    );
  });

  it("returns null when the document does not exist", () => {
    expect(computeCurrentHash(join(dir, "missing.md"))).toBeNull();
  });

  it("returns null when no spec can be found", () => {
    const docPath = join(dir, "doc.md");
    writeFileSync(docPath, "# Doc");

    expect(computeCurrentHash(docPath)).toBeNull();
  });
});
