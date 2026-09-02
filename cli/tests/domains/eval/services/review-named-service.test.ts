import type { Verdict } from "@/domains/eval/types.js";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { severityRank } from "@/domains/eval/models/verdict.js";
import reviewNamed from "@/domains/eval/services/review-named-service.js";
import selectReviewers from "@/domains/eval/services/select-reviewers-service.js";
import { PraxisConfig } from "@/domains/workspace/models/praxis-config.js";
import {
  createOpenRouterServer,
  useOpenRouterResponse,
  validationToolCallResponse,
} from "@tests/helpers/openrouter-msw.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

const server = createOpenRouterServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  process.env["OPENROUTER_API_KEY"] = "test-key";
});

afterAll(() => {
  server.close();
  delete process.env["OPENROUTER_API_KEY"];
});

const cleanups: (() => void)[] = [];

afterEach(() => {
  server.resetHandlers();
  while (cleanups.length) cleanups.pop()?.();
  delete process.env["MISSING_KEY_VAR"];
});

/** Every review in the test comes back with the given verdict. */
function useVerdict(tool: "validation_pass" | "validation_warn" | "validation_fail"): void {
  useOpenRouterResponse(
    server,
    validationToolCallResponse(tool, { reason: "Because.", issues: ["An issue"] }),
  );
}

/** A verdict with only the fields ranking depends on. */
function verdict(fields: Partial<Verdict>): Verdict {
  return { compliant: true, severity: "error", issues: [], reason: "", ...fields };
}

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

describe("severityRank", () => {
  it("ranks a compliant verdict lowest", () => {
    expect(severityRank(verdict({ compliant: true }))).toBe(0);
  });

  it("ranks a warning above a pass", () => {
    const pass = severityRank(verdict({ compliant: true }));
    const warn = severityRank(verdict({ compliant: false, severity: "warning" }));

    expect(warn).toBeGreaterThan(pass);
  });

  it("ranks an error above a warning", () => {
    const warn = severityRank(verdict({ compliant: false, severity: "warning" }));
    const error = severityRank(verdict({ compliant: false, severity: "error" }));

    expect(error).toBeGreaterThan(warn);
  });

  it("ignores severity on a compliant verdict", () => {
    const rank = severityRank(verdict({ compliant: true, severity: "error" }));

    expect(rank).toBe(0);
  });
});

describe("reviewer configuration", () => {
  it("raises when the project configures no reviewers", () => {
    const run = () => selectReviewers({ configured: project([]).reviewers });

    expect(run).toThrow(/reviewer/i);
  });

  it("raises when --reviewer names a reviewer that is not configured", () => {
    const run = () => selectReviewers({ configured: project([KEYED]).reviewers, only: "nope" });

    expect(run).toThrow(/nope/);
  });

  it("names the configured reviewers when --reviewer does not match", () => {
    const run = () => selectReviewers({ configured: project([KEYED]).reviewers, only: "nope" });

    expect(run).toThrow(/flash/);
  });

  it("raises when a reviewer's API key variable is unset", () => {
    const keyless = { name: "keyless", model: "m", apiKeyEnvVar: "MISSING_KEY_VAR" };
    const run = () => selectReviewers({ configured: project([keyless]).reviewers });

    expect(run).toThrow(/MISSING_KEY_VAR/);
  });

  it("raises when a reviewer's API key variable is set but empty", () => {
    process.env["MISSING_KEY_VAR"] = "";
    const keyless = { name: "keyless", model: "m", apiKeyEnvVar: "MISSING_KEY_VAR" };
    const run = () => selectReviewers({ configured: project([keyless]).reviewers });

    expect(run).toThrow(/MISSING_KEY_VAR/);
  });
});

describe("run() target dispatch", () => {
  /** A project with one keyed reviewer and two documents to review. */
  function reviewingProject(): {
    root: string;
    config: PraxisConfig;
    abs: (rel: string) => string;
  } {
    const { root, abs, cleanup } = createValidatorTmpdir({
      sources: ["specs"],
      files: {
        "specs/README.md": "# Spec\n\nDocuments must have a title.",
        "specs/doc.md": "# Doc",
        "specs/other.md": "# Other",
      },
      reviewers: [KEYED],
    });
    cleanups.push(cleanup);

    return { root, config: new PraxisConfig(root), abs };
  }

  it("counts an error verdict for a named target", async () => {
    useVerdict("validation_fail");
    const { root, config, abs } = reviewingProject();

    const result = await reviewNamed({
      targets: [abs("specs/doc.md")],
      root,
      config,
      useCache: false,
    });

    expect(result).toEqual({ errors: 1, warnings: 0 });
  });

  it("counts a warning separately from an error", async () => {
    useVerdict("validation_warn");
    const { root, config, abs } = reviewingProject();

    const result = await reviewNamed({
      targets: [abs("specs/doc.md")],
      root,
      config,
      useCache: false,
    });

    expect(result).toEqual({ errors: 0, warnings: 1 });
  });

  it("reviews every named target, not just the first", async () => {
    useVerdict("validation_fail");
    const { root, config, abs } = reviewingProject();

    const result = await reviewNamed({
      targets: [abs("specs/doc.md"), abs("specs/other.md")],
      root,
      config,
      useCache: false,
    });

    expect(result.errors).toBe(2);
  });

  it("counts nothing for a compliant target", async () => {
    useVerdict("validation_pass");
    const { root, config, abs } = reviewingProject();

    const result = await reviewNamed({
      targets: [abs("specs/doc.md")],
      root,
      config,
      useCache: false,
    });

    expect(result).toEqual({ errors: 0, warnings: 0 });
  });

  it("reports each verdict as it lands", async () => {
    useVerdict("validation_pass");
    const { root, config, abs } = reviewingProject();
    const seen: string[] = [];

    await reviewNamed({
      targets: [abs("specs/doc.md"), abs("specs/other.md")],
      root,
      config,
      useCache: false,
      onVerdict: ({ path }) => seen.push(path),
    });

    expect(seen).toHaveLength(2);
  });
});
