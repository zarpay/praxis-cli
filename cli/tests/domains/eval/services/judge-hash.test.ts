import type { JudgeConfig } from "@/types.js";

import { describe, expect, it } from "vitest";

import judgeHash from "@/domains/eval/services/hash-judge.js";

/** A baseline judge; tests vary one field at a time. */
function judge(overrides: Partial<JudgeConfig> = {}): JudgeConfig {
  return {
    name: "flash",
    model: "deepseek/deepseek-v4-flash-0731",
    apiKeyEnvVar: "OPENROUTER_API_KEY",
    ...overrides,
  };
}

describe("judgeHash", () => {
  it("returns an 8-character hex string", () => {
    expect(judgeHash(judge())).toMatch(/^[a-f0-9]{8}$/);
  });

  it("is stable regardless of key insertion order", () => {
    const scrambled = {
      apiKeyEnvVar: "OPENROUTER_API_KEY",
      model: "deepseek/deepseek-v4-flash-0731",
      name: "flash",
    } as JudgeConfig;

    const defaultHash = judgeHash(judge());
    const scrambledHash = judgeHash(scrambled);

    expect(scrambledHash).toBe(defaultHash);
  });

  it("ignores the judge's name — a rename must not invalidate verdicts", () => {
    const defaultHash = judgeHash(judge());
    const renamedHash = judgeHash(judge({ name: "renamed" }));

    expect(renamedHash).toBe(defaultHash);
  });

  it("ignores apiKeyEnvVar — key rotation must not invalidate verdicts", () => {
    const defaultHash = judgeHash(judge());
    const rotatedKeyHash = judgeHash(judge({ apiKeyEnvVar: "OTHER_KEY" }));

    expect(rotatedKeyHash).toBe(defaultHash);
  });

  it("changes when the model changes", () => {
    const defaultHash = judgeHash(judge());
    const otherModelHash = judgeHash(judge({ model: "other-model" }));

    expect(otherModelHash).not.toBe(defaultHash);
  });

  it("changes when the baseUrl changes", () => {
    const defaultHash = judgeHash(judge());
    const privateEndpointHash = judgeHash(judge({ baseUrl: "https://inference.internal/v1" }));

    expect(privateEndpointHash).not.toBe(defaultHash);
  });

  it("changes when the temperature changes", () => {
    const defaultHash = judgeHash(judge());
    const hotterHash = judgeHash(judge({ temperature: 0.7 }));

    expect(hotterHash).not.toBe(defaultHash);
  });

  it("hashes omitted settings identically to their explicit defaults", () => {
    const explicit = judge({
      baseUrl: "https://openrouter.ai/api/v1",
      temperature: 0,
      provider: "openrouter",
      options: {},
    });

    const defaultHash = judgeHash(judge());
    const explicitDefaultsHash = judgeHash(explicit);

    expect(explicitDefaultsHash).toBe(defaultHash);
  });

  it("changes when the provider changes", () => {
    const defaultHash = judgeHash(judge());
    const customProviderHash = judgeHash(judge({ provider: "./praxis-providers/echo.js" }));

    expect(customProviderHash).not.toBe(defaultHash);
  });

  it("changes when provider options change", () => {
    const defaultHash = judgeHash(judge());
    const customOptionsHash = judgeHash(judge({ options: { region: "us-east-1" } }));

    expect(customOptionsHash).not.toBe(defaultHash);
  });

  it("changes when the system prompt changes", () => {
    const defaultHash = judgeHash(judge());
    const rewordedPromptHash = judgeHash(judge(), "a different judging protocol");

    expect(rewordedPromptHash).not.toBe(defaultHash);
  });

  it("includes future unknown fields — new settings are behavioral by default", () => {
    const withFutureField = { ...judge(), maxTokens: 4096 } as unknown as JudgeConfig;

    const defaultHash = judgeHash(judge());
    const futureFieldHash = judgeHash(withFutureField);

    expect(futureFieldHash).not.toBe(defaultHash);
  });
});
