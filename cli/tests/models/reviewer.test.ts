import type { ReviewerConfig } from "@/types.js";

import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_REVIEWER_BASE_URL,
  DEFAULT_REVIEWER_PROVIDER,
  DEFAULT_REVIEWER_TEMPERATURE,
} from "@/models/praxis-config.js";
import { Reviewer } from "@/models/reviewer.js";

const CONFIG: ReviewerConfig = {
  name: "flash",
  model: "some/model",
  apiKeyEnvVar: "REVIEWER_TEST_KEY",
};

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
    /** The hash every variant is compared against. */
    function defaultHash(): string {
      const reviewer = Reviewer.fromConfig(CONFIG);

      return reviewer.hash();
    }

    /** The hash of CONFIG with one field overridden. */
    function hashWith(overrides: Partial<ReviewerConfig>): string {
      const reviewer = Reviewer.fromConfig({ ...CONFIG, ...overrides });

      return reviewer.hash();
    }

    it("is stable for equal configuration", () => {
      expect(defaultHash()).toBe(defaultHash());
    });

    it("ignores the name — renaming a reviewer keeps its verdicts", () => {
      const renamedHash = hashWith({ name: "renamed" });

      expect(renamedHash).toBe(defaultHash());
    });

    it("ignores the API key variable — where the key lives is not behavior", () => {
      const movedKeyHash = hashWith({ apiKeyEnvVar: "ELSEWHERE" });

      expect(movedKeyHash).toBe(defaultHash());
    });

    it("changes when the model changes — a behavioral epoch", () => {
      const swappedModelHash = hashWith({ model: "other/model" });

      expect(swappedModelHash).not.toBe(defaultHash());
    });

    it("hashes an omitted setting and its explicit default identically", () => {
      const explicitDefaultsHash = hashWith({
        baseUrl: DEFAULT_REVIEWER_BASE_URL,
        temperature: DEFAULT_REVIEWER_TEMPERATURE,
        provider: DEFAULT_REVIEWER_PROVIDER,
        options: {},
      });

      expect(explicitDefaultsHash).toBe(defaultHash());
    });

    it("is an 8-character hex string", () => {
      expect(defaultHash()).toMatch(/^[a-f0-9]{8}$/);
    });

    it("changes when the baseUrl changes", () => {
      const movedUrlHash = hashWith({ baseUrl: "https://inference.internal/v1" });

      expect(movedUrlHash).not.toBe(defaultHash());
    });

    it("changes when the temperature changes", () => {
      const hotterHash = hashWith({ temperature: 0.7 });

      expect(hotterHash).not.toBe(defaultHash());
    });

    it("changes when the provider changes", () => {
      const customProviderHash = hashWith({ provider: "./praxis-providers/echo.js" });

      expect(customProviderHash).not.toBe(defaultHash());
    });

    it("changes when provider options change", () => {
      const tunedHash = hashWith({ options: { region: "us-east-1" } });

      expect(tunedHash).not.toBe(defaultHash());
    });

    it("includes future unknown fields — new settings are behavioral by default", () => {
      const futureConfig = { ...CONFIG, maxTokens: 4096 } as unknown as typeof CONFIG;
      const futureHash = Reviewer.fromConfig(futureConfig).hash();

      expect(futureHash).not.toBe(defaultHash());
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
