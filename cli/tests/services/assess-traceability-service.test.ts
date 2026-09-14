import type { CuratorPlan } from "@tests/helpers/curator-provider.js";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import assessTraceabilityService from "@/services/assess-traceability-service.js";
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

/** The assessment a scripted curator returns for one statement. */
async function assess(traceability: CuratorPlan["traceability"]) {
  const { root, cleanup } = createValidatorTmpdir({
    sources: ["docs"],
    files: { "docs/README.md": "# Spec\n", "curator.js": curatorProviderModule({ traceability }) },
    curator: { model: "scripted", apiKeyEnvVar: "OPENROUTER_API_KEY", provider: "./curator.js" },
  });
  cleanups.push(cleanup);

  const cfg = testConfig(root, {
    sources: ["docs"],
    curator: { model: "scripted", apiKeyEnvVar: "OPENROUTER_API_KEY", provider: "./curator.js" },
  });

  return await assessTraceabilityService(cfg, {
    specPath: "docs/README.md",
    specContent: "# Spec\n",
    statement: "Error messages name what would be accepted.",
  });
}

describe("assessTraceabilityService", () => {
  it("reports a grounded claim as traceable, carrying the location", async () => {
    const result = await assess({
      traceable: true,
      grounding: "docs/README.md#error-messages",
      quoted_basis: "Error messages name what would be accepted.",
      reasoning: "Stated verbatim.",
    });

    expect(result.traceable).toBe(true);
    expect(result.grounding).toBe("docs/README.md#error-messages");
    expect(result.quotedBasis).toContain("what would be accepted");
  });

  it("refuses a claim of traceability that names no location", async () => {
    // Fail-safe: a generous reading here corrupts every rate computed
    // under the axiom afterwards.
    const result = await assess({ traceable: true, grounding: null, quoted_basis: "" });

    expect(result.traceable).toBe(false);
    expect(result.grounding).toBeNull();
  });

  it("reports an untraceable claim as untraceable even when it names a location", async () => {
    const result = await assess({
      traceable: false,
      grounding: "docs/README.md#somewhere",
      quoted_basis: "nothing says this",
    });

    expect(result.traceable).toBe(false);
    expect(result.grounding).toBeNull();
  });

  it("treats a missing traceable flag as not traceable", async () => {
    const result = await assess({ grounding: "docs/README.md#error-messages" });

    expect(result.traceable).toBe(false);
  });

  it("returns empty prose rather than undefined when the curator gave none", async () => {
    const result = await assess({ traceable: false, grounding: null });

    expect(result.quotedBasis).toBe("");
    expect(result.reasoning).toBe("");
  });

  it("carries the call's usage back for the session's spend line", async () => {
    const result = await assess({ traceable: false, grounding: null });

    expect(result.usage?.costUsd).toBe(0.001);
  });
});
