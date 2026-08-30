import type { JudgeConfig } from "@/core/config.js";

import { describe, expect, it } from "vitest";

import { judgeHash } from "@/eval/judge-hash.js";

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

    expect(judgeHash(scrambled)).toBe(judgeHash(judge()));
  });

  it("ignores the judge's name — a rename must not invalidate verdicts", () => {
    expect(judgeHash(judge({ name: "renamed" }))).toBe(judgeHash(judge()));
  });

  it("ignores apiKeyEnvVar — key rotation must not invalidate verdicts", () => {
    expect(judgeHash(judge({ apiKeyEnvVar: "OTHER_KEY" }))).toBe(judgeHash(judge()));
  });

  it("changes when the model changes", () => {
    expect(judgeHash(judge({ model: "other-model" }))).not.toBe(judgeHash(judge()));
  });

  it("changes when the baseUrl changes", () => {
    expect(judgeHash(judge({ baseUrl: "https://inference.internal/v1" }))).not.toBe(
      judgeHash(judge()),
    );
  });

  it("changes when the temperature changes", () => {
    expect(judgeHash(judge({ temperature: 0.7 }))).not.toBe(judgeHash(judge()));
  });

  it("hashes omitted settings identically to their explicit defaults", () => {
    const explicit = judge({ baseUrl: "https://openrouter.ai/api/v1", temperature: 0.1 });

    expect(judgeHash(explicit)).toBe(judgeHash(judge()));
  });

  it("changes when the system prompt changes", () => {
    expect(judgeHash(judge(), "a different judging protocol")).not.toBe(judgeHash(judge()));
  });

  it("includes future unknown fields — new settings are behavioral by default", () => {
    const withFutureField = { ...judge(), maxTokens: 4096 } as unknown as JudgeConfig;

    expect(judgeHash(withFutureField)).not.toBe(judgeHash(judge()));
  });
});
