import type { ReviewerConfig } from "@/types.js";

import { describe, expect, it } from "vitest";

import reviewerHash from "@/domains/eval/services/hash-reviewer-service.js";

/** A baseline reviewer; tests vary one field at a time. */
function reviewer(overrides: Partial<ReviewerConfig> = {}): ReviewerConfig {
  return {
    name: "flash",
    model: "deepseek/deepseek-v4-flash-0731",
    apiKeyEnvVar: "OPENROUTER_API_KEY",
    ...overrides,
  };
}

describe("reviewerHash", () => {
  it("returns an 8-character hex string", () => {
    expect(reviewerHash(reviewer())).toMatch(/^[a-f0-9]{8}$/);
  });

  it("is stable regardless of key insertion order", () => {
    const scrambled = {
      apiKeyEnvVar: "OPENROUTER_API_KEY",
      model: "deepseek/deepseek-v4-flash-0731",
      name: "flash",
    } as ReviewerConfig;

    const defaultHash = reviewerHash(reviewer());
    const scrambledHash = reviewerHash(scrambled);

    expect(scrambledHash).toBe(defaultHash);
  });

  it("ignores the reviewer's name — a rename must not invalidate verdicts", () => {
    const defaultHash = reviewerHash(reviewer());
    const renamedHash = reviewerHash(reviewer({ name: "renamed" }));

    expect(renamedHash).toBe(defaultHash);
  });

  it("ignores apiKeyEnvVar — key rotation must not invalidate verdicts", () => {
    const defaultHash = reviewerHash(reviewer());
    const rotatedKeyHash = reviewerHash(reviewer({ apiKeyEnvVar: "OTHER_KEY" }));

    expect(rotatedKeyHash).toBe(defaultHash);
  });

  it("changes when the model changes", () => {
    const defaultHash = reviewerHash(reviewer());
    const otherModelHash = reviewerHash(reviewer({ model: "other-model" }));

    expect(otherModelHash).not.toBe(defaultHash);
  });

  it("changes when the baseUrl changes", () => {
    const defaultHash = reviewerHash(reviewer());
    const privateEndpointHash = reviewerHash(
      reviewer({ baseUrl: "https://inference.internal/v1" }),
    );

    expect(privateEndpointHash).not.toBe(defaultHash);
  });

  it("changes when the temperature changes", () => {
    const defaultHash = reviewerHash(reviewer());
    const hotterHash = reviewerHash(reviewer({ temperature: 0.7 }));

    expect(hotterHash).not.toBe(defaultHash);
  });

  it("hashes omitted settings identically to their explicit defaults", () => {
    const explicit = reviewer({
      baseUrl: "https://openrouter.ai/api/v1",
      temperature: 0,
      provider: "openrouter",
      options: {},
    });

    const defaultHash = reviewerHash(reviewer());
    const explicitDefaultsHash = reviewerHash(explicit);

    expect(explicitDefaultsHash).toBe(defaultHash);
  });

  it("changes when the provider changes", () => {
    const defaultHash = reviewerHash(reviewer());
    const customProviderHash = reviewerHash(reviewer({ provider: "./praxis-providers/echo.js" }));

    expect(customProviderHash).not.toBe(defaultHash);
  });

  it("changes when provider options change", () => {
    const defaultHash = reviewerHash(reviewer());
    const customOptionsHash = reviewerHash(reviewer({ options: { region: "us-east-1" } }));

    expect(customOptionsHash).not.toBe(defaultHash);
  });

  it("changes when the system prompt changes", () => {
    const defaultHash = reviewerHash(reviewer());
    const rewordedPromptHash = reviewerHash(reviewer(), "a different reviewing protocol");

    expect(rewordedPromptHash).not.toBe(defaultHash);
  });

  it("includes future unknown fields — new settings are behavioral by default", () => {
    const withFutureField = { ...reviewer(), maxTokens: 4096 } as unknown as ReviewerConfig;

    const defaultHash = reviewerHash(reviewer());
    const futureFieldHash = reviewerHash(withFutureField);

    expect(futureFieldHash).not.toBe(defaultHash);
  });
});
