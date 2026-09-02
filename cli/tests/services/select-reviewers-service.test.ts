import { afterEach, describe, expect, it } from "vitest";

import { PraxisConfig } from "@/models/praxis-config.js";
import selectReviewersService from "@/services/select-reviewers-service.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
  delete process.env["MISSING_KEY_VAR"];
  delete process.env["OPENROUTER_API_KEY"];
});

/** A throwaway project configured with the given reviewers. */
function project(reviewers: { name: string; model: string; apiKeyEnvVar: string }[]): PraxisConfig {
  const { root, cleanup } = createValidatorTmpdir({
    sources: ["specs"],
    files: { "specs/README.md": "# Spec", "specs/doc.md": "# Doc" },
    reviewers,
  });
  cleanups.push(cleanup);

  return new PraxisConfig(root);
}

const KEYED = { name: "flash", model: "m", apiKeyEnvVar: "OPENROUTER_API_KEY" };

describe("selectReviewersService", () => {
  it("raises when the project configures no reviewers", () => {
    const run = () => selectReviewersService({ configured: project([]).reviewers });

    expect(run).toThrow(/reviewer/i);
  });

  it("raises when --reviewer names a reviewer that is not configured", () => {
    process.env["OPENROUTER_API_KEY"] = "test-key";
    const run = () =>
      selectReviewersService({ configured: project([KEYED]).reviewers, only: "nope" });

    expect(run).toThrow(/nope/);
  });

  it("names the configured reviewers when --reviewer does not match", () => {
    process.env["OPENROUTER_API_KEY"] = "test-key";
    const run = () =>
      selectReviewersService({ configured: project([KEYED]).reviewers, only: "nope" });

    expect(run).toThrow(/flash/);
  });

  it("raises when a reviewer's API key variable is unset", () => {
    const keyless = { name: "keyless", model: "m", apiKeyEnvVar: "MISSING_KEY_VAR" };
    const run = () => selectReviewersService({ configured: project([keyless]).reviewers });

    expect(run).toThrow(/MISSING_KEY_VAR/);
  });

  it("raises when a reviewer's API key variable is set but empty", () => {
    process.env["MISSING_KEY_VAR"] = "";
    const keyless = { name: "keyless", model: "m", apiKeyEnvVar: "MISSING_KEY_VAR" };
    const run = () => selectReviewersService({ configured: project([keyless]).reviewers });

    expect(run).toThrow(/MISSING_KEY_VAR/);
  });
});
