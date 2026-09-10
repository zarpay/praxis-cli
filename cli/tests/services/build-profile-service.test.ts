import { describe, expect, it } from "vitest";

import buildProfileService from "@/services/build-profile-service.js";
import { testConfig } from "@tests/helpers/test-config.js";

const CONFIG = testConfig("/project");

describe("buildProfileService", () => {
  describe("role", () => {
    it("renders the role section", () => {
      const output = buildProfileService(CONFIG, {
        role: "# Test Role\n\nRole content here.",
        responsibilities: [],
        constitution: [],
        context: [],
        reference: [],
      });

      expect(output).toContain("# Role");
      expect(output).toContain("Role content here.");
    });
  });

  describe("responsibilities", () => {
    it("adds responsibilities with --- separators between items", () => {
      const output = buildProfileService(CONFIG, {
        role: "",
        responsibilities: ["First responsibility content.", "Second responsibility content."],
        constitution: [],
        context: [],
        reference: [],
      });

      expect(output).toContain("# Responsibilities");
      expect(output).toContain("First responsibility content.");
      expect(output).toContain("---");
      expect(output).toContain("Second responsibility content.");
    });

    it("handles single responsibility without separator", () => {
      const output = buildProfileService(CONFIG, {
        role: "",
        responsibilities: ["Only responsibility."],
        constitution: [],
        context: [],
        reference: [],
      });

      expect(output).toContain("Only responsibility.");
      expect(output).not.toContain("---");
    });

    it("skips section if empty array", () => {
      const output = buildProfileService(CONFIG, {
        role: "",
        responsibilities: [],
        constitution: [],
        context: [],
        reference: [],
      });

      expect(output).not.toContain("# Responsibilities");
    });
  });

  describe("constitution", () => {
    it("adds constitution with blank line separators (not ---)", () => {
      const output = buildProfileService(CONFIG, {
        role: "",
        responsibilities: [],
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
        role: "",
        responsibilities: [],
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
        role: "",
        responsibilities: [],
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
        role: "Role body",
        responsibilities: ["Resp 1"],
        constitution: ["Const 1"],
        context: ["Ctx 1"],
        reference: ["Ref 1"],
      });

      const rolePos = profile.indexOf("# Role");
      const respPos = profile.indexOf("# Responsibilities");
      const constPos = profile.indexOf("# Constitution");
      const ctxPos = profile.indexOf("# Context");
      const refPos = profile.indexOf("# Reference");

      expect(rolePos).toBeLessThan(respPos);
      expect(respPos).toBeLessThan(constPos);
      expect(constPos).toBeLessThan(ctxPos);
      expect(ctxPos).toBeLessThan(refPos);
    });

    it("produces no frontmatter — platform wrapping belongs to plugins", () => {
      const profile = buildProfileService(CONFIG, {
        role: "Role body",
        responsibilities: [],
        constitution: [],
        context: [],
        reference: [],
      });

      expect(profile).not.toMatch(/^---\n/);
      expect(profile.startsWith("# Role")).toBe(true);
    });

    it("omits empty sections", () => {
      const profile = buildProfileService(CONFIG, {
        role: "Role body",
        responsibilities: [],
        constitution: [],
        context: [],
        reference: [],
      });

      expect(profile).toContain("# Role");
      expect(profile).not.toContain("# Responsibilities");
      expect(profile).not.toContain("# Constitution");
    });

    it("returns an empty string when every section is empty", () => {
      const profile = buildProfileService(CONFIG, {
        role: "",
        responsibilities: [],
        constitution: [],
        context: [],
        reference: [],
      });

      expect(profile).toBe("");
    });
  });
});
