import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_REVIEWER_BASE_URL,
  DEFAULT_REVIEWER_PROVIDER,
  DEFAULT_REVIEWER_TEMPERATURE,
} from "@/models/praxis-config.js";
import { Reviewer } from "@/models/reviewer.js";

const CONFIG = { name: "flash", model: "some/model", apiKeyEnvVar: "REVIEWER_TEST_KEY" };

afterEach(() => {
  delete process.env["REVIEWER_TEST_KEY"];
});

describe("Reviewer", () => {
  it("materializes the defaults an omitted setting resolves to", () => {
    const reviewer = Reviewer.fromConfig(CONFIG);

    expect(reviewer.baseUrl).toBe(DEFAULT_REVIEWER_BASE_URL);
    expect(reviewer.temperature).toBe(DEFAULT_REVIEWER_TEMPERATURE);
    expect(reviewer.provider).toBe(DEFAULT_REVIEWER_PROVIDER);
    expect(reviewer.options).toEqual({});
  });

  describe("hash", () => {
    it("is stable for equal configuration", () => {
      expect(Reviewer.fromConfig(CONFIG).hash()).toBe(Reviewer.fromConfig(CONFIG).hash());
    });

    it("ignores the name — renaming a reviewer keeps its verdicts", () => {
      const renamed = Reviewer.fromConfig({ ...CONFIG, name: "renamed" });

      expect(renamed.hash()).toBe(Reviewer.fromConfig(CONFIG).hash());
    });

    it("ignores the API key variable — where the key lives is not behavior", () => {
      const moved = Reviewer.fromConfig({ ...CONFIG, apiKeyEnvVar: "ELSEWHERE" });

      expect(moved.hash()).toBe(Reviewer.fromConfig(CONFIG).hash());
    });

    it("changes when the model changes — a behavioral epoch", () => {
      const swapped = Reviewer.fromConfig({ ...CONFIG, model: "other/model" });

      expect(swapped.hash()).not.toBe(Reviewer.fromConfig(CONFIG).hash());
    });

    it("hashes an omitted setting and its explicit default identically", () => {
      const explicit = Reviewer.fromConfig({
        ...CONFIG,
        baseUrl: DEFAULT_REVIEWER_BASE_URL,
        temperature: DEFAULT_REVIEWER_TEMPERATURE,
        provider: DEFAULT_REVIEWER_PROVIDER,
        options: {},
      });

      expect(explicit.hash()).toBe(Reviewer.fromConfig(CONFIG).hash());
    });

    it("is an 8-character hex string", () => {
      expect(Reviewer.fromConfig(CONFIG).hash()).toMatch(/^[a-f0-9]{8}$/);
    });

    it("changes when the baseUrl changes", () => {
      const moved = Reviewer.fromConfig({ ...CONFIG, baseUrl: "https://inference.internal/v1" });

      expect(moved.hash()).not.toBe(Reviewer.fromConfig(CONFIG).hash());
    });

    it("changes when the temperature changes", () => {
      const hotter = Reviewer.fromConfig({ ...CONFIG, temperature: 0.7 });

      expect(hotter.hash()).not.toBe(Reviewer.fromConfig(CONFIG).hash());
    });

    it("changes when the provider changes", () => {
      const custom = Reviewer.fromConfig({ ...CONFIG, provider: "./praxis-providers/echo.js" });

      expect(custom.hash()).not.toBe(Reviewer.fromConfig(CONFIG).hash());
    });

    it("changes when provider options change", () => {
      const tuned = Reviewer.fromConfig({ ...CONFIG, options: { region: "us-east-1" } });

      expect(tuned.hash()).not.toBe(Reviewer.fromConfig(CONFIG).hash());
    });

    it("includes future unknown fields — new settings are behavioral by default", () => {
      const futureConfig = { ...CONFIG, maxTokens: 4096 } as unknown as typeof CONFIG;

      expect(Reviewer.fromConfig(futureConfig).hash()).not.toBe(Reviewer.fromConfig(CONFIG).hash());
    });
  });

  it("cacheIdentity carries name, model and hash — what a cache entry records", () => {
    const reviewer = Reviewer.fromConfig(CONFIG);

    expect(reviewer.cacheIdentity()).toEqual({
      name: "flash",
      model: "some/model",
      hash: reviewer.hash(),
    });
  });

  describe("apiKey", () => {
    it("reads the key from the environment at call time", () => {
      process.env["REVIEWER_TEST_KEY"] = "secret";

      expect(Reviewer.fromConfig(CONFIG).apiKey()).toBe("secret");
    });

    it("throws, naming the variable, when it is unset", () => {
      expect(() => Reviewer.fromConfig(CONFIG).apiKey()).toThrow("REVIEWER_TEST_KEY");
    });

    it("throws when the variable is set but empty", () => {
      process.env["REVIEWER_TEST_KEY"] = "";

      expect(() => Reviewer.fromConfig(CONFIG).apiKey()).toThrow("REVIEWER_TEST_KEY");
    });
  });
});
