import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import reviewNamed from "@/eval/services/review-named-service.js";
import selectReviewers from "@/eval/services/select-reviewers-service.js";
import { PraxisConfig } from "@/workspace/models/praxis-config.js";
import {
  OPENROUTER_URL,
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

  it("takes the worst verdict when reviewers disagree about one target", async () => {
    server.use(
      http.post(OPENROUTER_URL, async ({ request }) => {
        const body = (await request.json()) as { model: string };

        return HttpResponse.json(
          body.model === "strict-model"
            ? validationToolCallResponse("validation_fail", { reason: "No.", issues: ["Bad"] })
            : validationToolCallResponse("validation_pass", { reason: "Fine." }),
        );
      }),
    );
    const { root, abs, cleanup } = createValidatorTmpdir({
      sources: ["specs"],
      files: { "specs/README.md": "# Spec", "specs/doc.md": "# Doc" },
      reviewers: [
        KEYED,
        { name: "strict", model: "strict-model", apiKeyEnvVar: KEYED.apiKeyEnvVar },
      ],
    });
    cleanups.push(cleanup);

    const result = await reviewNamed({
      targets: [abs("specs/doc.md")],
      root,
      config: new PraxisConfig(root),
      useCache: false,
    });

    // One reviewer passed and one failed: the target is an error, not a pass.
    expect(result).toEqual({ errors: 1, warnings: 0 });
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
