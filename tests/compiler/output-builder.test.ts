import { describe, expect, it } from "vitest";

import { OutputBuilder } from "@/compiler/output-builder.js";

describe("OutputBuilder", () => {
  describe("addRole()", () => {
    it("stores role content", () => {
      const builder = new OutputBuilder();
      builder.addRole("# Test Role\n\nRole content here.");
      const output = builder.build();

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
      const output = builder.build();

      expect(output).toContain("# Responsibilities");
      expect(output).toContain("First responsibility content.");
      expect(output).toContain("---");
      expect(output).toContain("Second responsibility content.");
    });

    it("handles single responsibility without separator", () => {
      const builder = new OutputBuilder();
      builder.addResponsibilities(["Only responsibility."]);
      const output = builder.build();

      expect(output).toContain("Only responsibility.");
      const dashCount = (output.match(/---/g) || []).length;
      expect(dashCount).toBeLessThanOrEqual(1);
    });

    it("skips section if empty array", () => {
      const builder = new OutputBuilder();
      builder.addResponsibilities([]);
      const output = builder.build();

      expect(output).not.toContain("# Responsibilities");
    });
  });

  describe("addConstitution()", () => {
    it("adds constitution with blank line separators (not ---)", () => {
      const builder = new OutputBuilder();
      builder.addConstitution(["Identity content.", "Principles content."]);
      const output = builder.build();

      expect(output).toContain("# Constitution");
      expect(output).toContain("Identity content.");
      expect(output).toContain("Principles content.");
    });
  });

  describe("addContext()", () => {
    it("adds context with --- separators", () => {
      const builder = new OutputBuilder();
      builder.addContext(["First context.", "Second context."]);
      const output = builder.build();

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
      const output = builder.build();

      expect(output).toContain("# Reference");
      expect(output).toContain("First reference.");
      expect(output).toContain("---");
      expect(output).toContain("Second reference.");
    });
  });

  describe("buildProfile()", () => {
    it("assembles sections in correct order without frontmatter", () => {
      const builder = new OutputBuilder({
        agentMetadata: { name: "test", description: "Test agent" },
      });
      builder.addRole("Role body");
      builder.addResponsibilities(["Resp 1"]);
      builder.addConstitution(["Const 1"]);
      builder.addContext(["Ctx 1"]);
      builder.addReference(["Ref 1"]);

      const profile = builder.buildProfile();

      // No frontmatter
      expect(profile).not.toMatch(/^---\n/);
      expect(profile).not.toContain("name: test");

      // Sections in order
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

    it("omits empty sections", () => {
      const builder = new OutputBuilder();
      builder.addRole("Role body");

      const profile = builder.buildProfile();

      expect(profile).toContain("# Role");
      expect(profile).not.toContain("# Responsibilities");
      expect(profile).not.toContain("# Constitution");
    });
  });

  describe("build()", () => {
    it("assembles sections in correct order", () => {
      const builder = new OutputBuilder();
      builder.addRole("Role body");
      builder.addResponsibilities(["Resp 1"]);
      builder.addConstitution(["Const 1"]);
      builder.addContext(["Ctx 1"]);
      builder.addReference(["Ref 1"]);

      const output = builder.build();
      const rolePos = output.indexOf("# Role");
      const respPos = output.indexOf("# Responsibilities");
      const constPos = output.indexOf("# Constitution");
      const ctxPos = output.indexOf("# Context");
      const refPos = output.indexOf("# Reference");

      expect(rolePos).toBeLessThan(respPos);
      expect(respPos).toBeLessThan(constPos);
      expect(constPos).toBeLessThan(ctxPos);
      expect(ctxPos).toBeLessThan(refPos);
    });

    it("generates Claude Code frontmatter when agent metadata is provided", () => {
      const builder = new OutputBuilder({
        agentMetadata: {
          name: "test-agent",
          description: "A test agent",
        },
      });
      builder.addRole("Role body");
      const output = builder.build();

      expect(output).toMatch(/^---\n/);
      expect(output).toContain("name: test-agent");
      expect(output).toContain("description: A test agent");
    });

    it("includes optional agent metadata fields", () => {
      const builder = new OutputBuilder({
        agentMetadata: {
          name: "test-agent",
          description: "A test agent",
          tools: "Read, Glob, Grep",
          model: "opus",
          permissionMode: "plan",
        },
      });
      builder.addRole("Role body");
      const output = builder.build();

      expect(output).toContain("tools: Read, Glob, Grep");
      expect(output).toContain("model: opus");
      expect(output).toContain("permissionMode: plan");
    });

    it("quotes description containing special YAML characters", () => {
      const builder = new OutputBuilder({
        agentMetadata: {
          name: "test-agent",
          description: "Use this agent to do: things & stuff [here]",
        },
      });
      builder.addRole("Role body");
      const output = builder.build();

      expect(output).toContain('description: "Use this agent to do: things & stuff [here]"');
    });
  });
});
