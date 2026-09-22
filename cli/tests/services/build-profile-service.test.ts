import { describe, expect, it } from "vitest";

import buildProfileService from "@/services/build-profile-service.js";
import { testConfig } from "@tests/helpers/test-config.js";

const CONFIG = testConfig("/project");

describe("buildProfileService", () => {
  describe("expert", () => {
    it("renders the expert section", () => {
      const output = buildProfileService(CONFIG, {
        expert: "# Test Expert\n\nExpert content here.",
        practices: [],
        constitution: [],
        context: [],
        reference: [],
      });

      expect(output).toContain("# Expert");
      expect(output).toContain("Expert content here.");
    });
  });

  describe("practices", () => {
    it("adds practices with --- separators between items", () => {
      const output = buildProfileService(CONFIG, {
        expert: "",
        practices: ["First practice content.", "Second practice content."],
        constitution: [],
        context: [],
        reference: [],
      });

      expect(output).toContain("# Practices");
      expect(output).toContain("First practice content.");
      expect(output).toContain("---");
      expect(output).toContain("Second practice content.");
    });

    it("handles single practice without separator", () => {
      const output = buildProfileService(CONFIG, {
        expert: "",
        practices: ["Only practice."],
        constitution: [],
        context: [],
        reference: [],
      });

      expect(output).toContain("Only practice.");
      expect(output).not.toContain("---");
    });

    it("skips section if empty array", () => {
      const output = buildProfileService(CONFIG, {
        expert: "",
        practices: [],
        constitution: [],
        context: [],
        reference: [],
      });

      expect(output).not.toContain("# Practices");
    });
  });

  describe("constitution", () => {
    it("adds constitution with blank line separators (not ---)", () => {
      const output = buildProfileService(CONFIG, {
        expert: "",
        practices: [],
        constitution: ["Identity content.", "Principles content."],
        context: [],
        reference: [],
      });

      expect(output).toContain("# Constitution");
      expect(output).toContain("Identity content.");
      expect(output).not.toContain("---");
      expect(output).toContain("Principles content.");
    });
  });

  describe("context", () => {
    it("adds context with --- separators", () => {
      const output = buildProfileService(CONFIG, {
        expert: "",
        practices: [],
        constitution: [],
        context: ["First context.", "Second context."],
        reference: [],
      });

      expect(output).toContain("# Context");
      expect(output).toContain("First context.");
      expect(output).toContain("---");
      expect(output).toContain("Second context.");
    });
  });

  describe("reference", () => {
    it("adds reference with --- separators", () => {
      const output = buildProfileService(CONFIG, {
        expert: "",
        practices: [],
        constitution: [],
        context: [],
        reference: ["First reference.", "Second reference."],
      });

      expect(output).toContain("# Reference");
      expect(output).toContain("First reference.");
      expect(output).toContain("---");
      expect(output).toContain("Second reference.");
    });
  });

  describe("assembly", () => {
    it("assembles sections in a fixed order", () => {
      const profile = buildProfileService(CONFIG, {
        expert: "Expert body",
        practices: ["Practice 1"],
        constitution: ["Const 1"],
        context: ["Ctx 1"],
        reference: ["Ref 1"],
      });

      const expertPos = profile.indexOf("# Expert");
      const practicesPos = profile.indexOf("# Practices");
      const constPos = profile.indexOf("# Constitution");
      const ctxPos = profile.indexOf("# Context");
      const refPos = profile.indexOf("# Reference");

      expect(expertPos).toBeLessThan(practicesPos);
      expect(practicesPos).toBeLessThan(constPos);
      expect(constPos).toBeLessThan(ctxPos);
      expect(ctxPos).toBeLessThan(refPos);
    });

    it("produces no frontmatter — platform wrapping belongs to plugins", () => {
      const profile = buildProfileService(CONFIG, {
        expert: "Expert body",
        practices: [],
        constitution: [],
        context: [],
        reference: [],
      });

      expect(profile).not.toMatch(/^---\n/);
      expect(profile.startsWith("# Expert")).toBe(true);
    });

    it("omits empty sections", () => {
      const profile = buildProfileService(CONFIG, {
        expert: "Expert body",
        practices: [],
        constitution: [],
        context: [],
        reference: [],
      });

      expect(profile).toContain("# Expert");
      expect(profile).not.toContain("# Practices");
      expect(profile).not.toContain("# Constitution");
    });

    it("returns an empty string when every section is empty", () => {
      const profile = buildProfileService(CONFIG, {
        expert: "",
        practices: [],
        constitution: [],
        context: [],
        reference: [],
      });

      expect(profile).toBe("");
    });
  });
});
