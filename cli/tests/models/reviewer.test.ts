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
        temperature: DEFAULT_REVIEWER_TEMPERATURE,
      });

      expect(explicit.hash()).toBe(Reviewer.fromConfig(CONFIG).hash());
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
