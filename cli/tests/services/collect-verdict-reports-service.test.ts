import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import collectVerdictReportsService from "@/services/collect-verdict-reports-service.js";
import { testConfig } from "@tests/helpers/test-config.js";

const FLASH = { name: "flash", model: "m1", apiKeyEnvVar: "OPENROUTER_API_KEY" };
const V32 = { name: "v32", model: "m2", apiKeyEnvVar: "OPENROUTER_API_KEY" };

describe("collectVerdictReportsService", () => {
  let root: string;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-collect-verdicts-test-${randomUUID()}`);
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "a.ts"), "export {};");
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("reports one entry per configured reviewer, in config order", () => {
    const cfg = testConfig(root, { reviewers: [FLASH, V32] });

    const result = collectVerdictReportsService(cfg, { targetPath: join(root, "src", "a.ts") });

    expect(result.reports.map((entry) => entry.reviewer)).toEqual(["flash", "v32"]);
    expect(result.reports[0]?.report.status).toBe("not_validated");
  });

  it("names reviewers only when more than one could disagree", () => {
    const one = testConfig(root, { reviewers: [FLASH] });
    const two = testConfig(root, { reviewers: [FLASH, V32] });
    const target = join(root, "src", "a.ts");

    const singleReport = collectVerdictReportsService(one, { targetPath: target });
    const pairReport = collectVerdictReportsService(two, { targetPath: target });

    expect(singleReport.named).toBe(false);
    expect(pairReport.named).toBe(true);
  });

  it("refuses a target that does not exist", () => {
    const cfg = testConfig(root, { reviewers: [FLASH] });

    const collectMissing = () => collectVerdictReportsService(cfg, { targetPath: "src/gone.ts" });

    expect(collectMissing).toThrow(/gone.ts/);
  });

  it("refuses when no reviewer is configured to have an opinion", () => {
    const cfg = testConfig(root, { reviewers: [] });

    const collectUnreviewed = () =>
      collectVerdictReportsService(cfg, { targetPath: join(root, "src", "a.ts") });

    expect(collectUnreviewed).toThrow(/reviewer/i);
  });
});
