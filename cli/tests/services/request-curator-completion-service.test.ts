import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import requestCuratorCompletionService from "@/services/request-curator-completion-service.js";
import { curatorProviderModule } from "@tests/helpers/curator-provider.js";
import { testConfig } from "@tests/helpers/test-config.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

beforeAll(() => {
  process.env["OPENROUTER_API_KEY"] = "test-key";
});

afterAll(() => {
  delete process.env["OPENROUTER_API_KEY"];
});

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

/** A project whose curator is the scripted local module, or absent. */
function project(): string {
  const { root, cleanup } = createValidatorTmpdir({
    sources: ["docs"],
    files: {
      "docs/README.md": "# Spec\n",
      "curator.js": curatorProviderModule({ traceability: { traceable: false, grounding: null } }),
    },
  });
  cleanups.push(cleanup);

  return root;
}

/** A config with the scripted curator wired in. */
function withCurator(root: string) {
  return testConfig(root, {
    sources: ["docs"],
    curator: { model: "scripted", apiKeyEnvVar: "OPENROUTER_API_KEY", provider: "./curator.js" },
  });
}

/** The traceability tool, whose shape the scripted curator answers. */
function traceabilityTool() {
  return [{ type: "function", function: { name: "traceability_verdict" } }];
}

describe("requestCuratorCompletionService", () => {
  it("returns the tool call the curator made, unparsed", async () => {
    const root = project();

    const completion = await requestCuratorCompletionService(withCurator(root), {
      systemPrompt: "system",
      userPrompt: "question",
      tools: traceabilityTool(),
    });

    // The curator's prompts own their own shapes; nothing here parses.
    expect(completion.toolName).toBe("traceability_verdict");
    expect(completion.args).toEqual({ traceable: false, grounding: null });
  });

  it("carries usage back, so a session can total its spend", async () => {
    const root = project();

    const completion = await requestCuratorCompletionService(withCurator(root), {
      systemPrompt: "system",
      userPrompt: "question",
      tools: traceabilityTool(),
    });

    expect(completion.usage).toEqual({ promptTokens: 10, completionTokens: 5, costUsd: 0.001 });
  });

  it("refuses instructively when no curator is configured", async () => {
    const root = project();
    const attempt = requestCuratorCompletionService(testConfig(root, { sources: ["docs"] }), {
      systemPrompt: "system",
      userPrompt: "question",
      tools: traceabilityTool(),
    });

    // Labeling is deferred, never faked.
    await expect(attempt).rejects.toThrow(/No curator configured/);
  });
});
