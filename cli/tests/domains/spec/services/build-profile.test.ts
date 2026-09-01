import { describe, expect, it } from "vitest";

import { OutputBuilder } from "@/domains/spec/services/build-profile.js";

describe("OutputBuilder", () => {
  describe("addRole()", () => {
    it("stores role content", () => {
      const builder = new OutputBuilder();
      builder.addRole("# Test Role\n\nRole content here.");
      const output = builder.buildProfile();

      expect(output).toContain("# Role");
      expect(output).toContain("Role content here.");
    });
  });

  describe("addResponsibilities()", () => {
    it("adds responsibilities with --- separators between items", () => {
      const builder = new OutputBuilder();
      builder.addResponsibilities([
        "First responsibility content.",
        "Second responsibility content.",
      ]);
      const output = builder.buildProfile();

      expect(output).toContain("# Responsibilities");
      expect(output).toContain("First responsibility content.");
      expect(output).toContain("---");
      expect(output).toContain("Second responsibility content.");
    });

    it("handles single responsibility without separator", () => {
      const builder = new OutputBuilder();
      builder.addResponsibilities(["Only responsibility."]);
      const output = builder.buildProfile();

      expect(output).toContain("Only responsibility.");
      expect(output).not.toContain("---");
    });

    it("skips section if empty array", () => {
      const builder = new OutputBuilder();
      builder.addResponsibilities([]);
      const output = builder.buildProfile();

      expect(output).not.toContain("# Responsibilities");
    });
  });

  describe("addConstitution()", () => {
    it("adds constitution with blank line separators (not ---)", () => {
      const builder = new OutputBuilder();
      builder.addConstitution(["Identity content.", "Principles content."]);
      const output = builder.buildProfile();

      expect(output).toContain("# Constitution");
      expect(output).toContain("Identity content.");
      expect(output).not.toContain("---");
      expect(output).toContain("Principles content.");
    });
  });

  describe("addContext()", () => {
    it("adds context with --- separators", () => {
      const builder = new OutputBuilder();
      builder.addContext(["First context.", "Second context."]);
      const output = builder.buildProfile();

      expect(output).toContain("# Context");
      expect(output).toContain("First context.");
      expect(output).toContain("---");
      expect(output).toContain("Second context.");
    });
  });

  describe("addReference()", () => {
    it("adds reference with --- separators", () => {
      const builder = new OutputBuilder();
      builder.addReference(["First reference.", "Second reference."]);
      const output = builder.buildProfile();

      expect(output).toContain("# Reference");
      expect(output).toContain("First reference.");
      expect(output).toContain("---");
      expect(output).toContain("Second reference.");
    });
  });

  describe("buildProfile()", () => {
    it("assembles sections in a fixed order", () => {
      const builder = new OutputBuilder();
      builder.addRole("Role body");
      builder.addResponsibilities(["Resp 1"]);
      builder.addConstitution(["Const 1"]);
      builder.addContext(["Ctx 1"]);
      builder.addReference(["Ref 1"]);

      const profile = builder.buildProfile();

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
      const builder = new OutputBuilder();
      builder.addRole("Role body");

      const profile = builder.buildProfile();

      expect(profile).not.toMatch(/^---\n/);
      expect(profile.startsWith("# Role")).toBe(true);
    });

    it("omits empty sections", () => {
      const builder = new OutputBuilder();
      builder.addRole("Role body");

      const profile = builder.buildProfile();

      expect(profile).toContain("# Role");
      expect(profile).not.toContain("# Responsibilities");
      expect(profile).not.toContain("# Constitution");
    });

    it("returns an empty string when no sections were added", () => {
      expect(new OutputBuilder().buildProfile()).toBe("");
    });
  });
});
