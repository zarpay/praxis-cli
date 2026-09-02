import { describe, expect, it } from "vitest";

import { ExpertFile } from "@/models/expert-file.js";

/** Builds an expert from frontmatter lines, without touching the filesystem. */
function expert(lines: string[], path = "/project/experts/steward.md"): ExpertFile {
  const content = ["---", ...lines, "---", "", "# Steward"].join("\n");
  return ExpertFile.fromContent(content, path);
}

describe("ExpertFile", () => {
  describe("alias and description", () => {
    it("reads both when present", () => {
      const subject = expert(["alias: Scooper", "description: reviews services"]);

      expect(subject.alias).toBe("Scooper");
      expect(subject.description).toBe("reviews services");
    });

    it("raises when alias is absent — a file without one is not an expert", () => {
      const build = () => expert(["type: expert"]);

      expect(build).toThrow(/missing required frontmatter field "alias"/);
    });

    it("names the offending file in the message", () => {
      const build = () => expert(["type: expert"], "/project/experts/broken.md");

      expect(build).toThrow(/\/project\/experts\/broken\.md/);
    });

    it("raises when alias is present but not a string", () => {
      const build = () => expert(["alias:", "  - Scooper"]);

      expect(build).toThrow(/expected a string, got \["Scooper"\]/);
    });

    it("allows an absent description — the compiler emits no metadata for it", () => {
      const subject = expert(["alias: Scooper"]);

      expect(subject.description).toBeUndefined();
    });
  });

  describe("constitution", () => {
    it("reads a declared glob", () => {
      const subject = expert(["alias: A", "constitution:", '  - "context/constitution/*.md"']);

      expect(subject.constitution).toEqual(["context/constitution/*.md"]);
    });

    it("is empty when the key is absent", () => {
      const subject = expert(["alias: Scooper"]);

      expect(subject.constitution).toEqual([]);
    });

    it("raises on a boolean, which is not a glob", () => {
      const build = () => expert(["alias: A", "constitution: false"]);

      expect(build).toThrow(/expected a string, got false/);
    });
  });

  describe("refs()", () => {
    it("reads each reference key", () => {
      const subject = expert([
        "alias: A",
        "practices:",
        '  - "practices/services.md"',
        "context:",
        '  - "context/why.md"',
        "refs:",
        '  - "reference/vocab.md"',
      ]);

      expect(subject.refs("practices")).toEqual(["practices/services.md"]);
      expect(subject.refs("context")).toEqual(["context/why.md"]);
      expect(subject.refs("refs")).toEqual(["reference/vocab.md"]);
    });

    it("returns an empty array for an undeclared key", () => {
      const subject = expert(["alias: Scooper"]);

      expect(subject.refs("practices")).toEqual([]);
    });
  });

  describe("agent settings", () => {
    it("reads the agent_-prefixed keys", () => {
      const subject = expert([
        "alias: A",
        "agent_tools: Read, Glob",
        "agent_model: opus",
        "agent_permission_mode: plan",
      ]);

      expect(subject.agentTools).toBe("Read, Glob");
      expect(subject.agentModel).toBe("opus");
      expect(subject.agentPermissionMode).toBe("plan");
    });

    it("returns undefined for each when absent", () => {
      const subject = expert(["alias: Scooper"]);

      expect(subject.agentTools).toBeUndefined();
      expect(subject.agentModel).toBeUndefined();
      expect(subject.agentPermissionMode).toBeUndefined();
    });

    it("raises on a list where a string belongs", () => {
      const build = () => expert(["alias: A", "agent_tools:", "  - Read", "  - Glob"]);

      expect(build).toThrow(/Invalid "agent_tools"/);
    });
  });

  describe("targeting fields compiled into the spec", () => {
    it("reads validates, cohort, excludes and exemplars", () => {
      const subject = expert([
        "alias: A",
        "validates:",
        '  - "src/services/*.ts"',
        "cohort: by_directory",
        "excludes:",
        '  - "src/services/legacy.ts"',
        "exemplars:",
        '  - "src/services/good.ts"',
      ]);

      expect(subject.validates).toEqual(["src/services/*.ts"]);
      expect(subject.cohort).toBe("by_directory");
      expect(subject.excludes).toEqual(["src/services/legacy.ts"]);
      expect(subject.exemplars).toEqual(["src/services/good.ts"]);
    });

    it("returns empty lists and an undeclared cohort when absent", () => {
      const subject = expert(["alias: Scooper"]);

      expect(subject.validates).toEqual([]);
      expect(subject.excludes).toEqual([]);
      expect(subject.exemplars).toEqual([]);
      expect(subject.cohort).toBeUndefined();
    });

    it("raises on a cohort outside the enum, at compile time", () => {
      const build = () => expert(["alias: A", "cohort: by_module"]);

      expect(build).toThrow(/expected "by_file" or "by_directory", got "by_module"/);
    });
  });

  describe("agentName", () => {
    it("slugs the alias", () => {
      const subject = expert(["alias: Feature Steward"]);

      expect(subject.agentName).toBe("feature-steward");
    });

    it("raises when the alias slugs to nothing", () => {
      const build = () => expert(["alias: '***'"]);

      expect(build).toThrow(/at least one letter or digit/);
    });
  });

  describe("body()", () => {
    it("returns the prose with frontmatter stripped and trimmed", () => {
      const subject = expert(["alias: Scooper"]);

      expect(subject.body()).toBe("# Steward");
    });
  });

  it("keeps the path it was built with", () => {
    const subject = expert(["alias: Scooper"], "/project/experts/scooper.md");

    expect(subject.path).toBe("/project/experts/scooper.md");
  });
});
