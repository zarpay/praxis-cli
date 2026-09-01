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

    it("reports absence rather than throwing", () => {
      const subject = expert(["type: expert"]);

      expect(subject.alias).toBeUndefined();
      expect(subject.description).toBeUndefined();
    });
  });

  describe("constitution", () => {
    it("declaresConstitution is true for a declared glob", () => {
      const subject = expert(["constitution:", '  - "context/constitution/*.md"']);

      expect(subject.declaresConstitution).toBe(true);
      expect(subject.constitution).toEqual(["context/constitution/*.md"]);
    });

    it("declaresConstitution is false when the key is absent", () => {
      const subject = expert(["alias: Scooper"]);

      expect(subject.declaresConstitution).toBe(false);
    });

    it("treats `constitution: false` as no constitution", () => {
      const subject = expert(["constitution: false"]);

      expect(subject.declaresConstitution).toBe(false);
    });
  });

  describe("refs()", () => {
    it("reads each reference key", () => {
      const subject = expert([
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
  });

  describe("targeting fields compiled into the spec", () => {
    it("reads validates, cohort, excludes and exemplars", () => {
      const subject = expert([
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

    it("returns undefined, not empty arrays, when undeclared", () => {
      const subject = expert(["alias: Scooper"]);

      expect(subject.validates).toBeUndefined();
      expect(subject.excludes).toBeUndefined();
      expect(subject.exemplars).toBeUndefined();
      expect(subject.cohort).toBeUndefined();
    });
  });

  it("keeps the path it was built with", () => {
    const subject = expert(["alias: Scooper"], "/project/experts/scooper.md");

    expect(subject.path).toBe("/project/experts/scooper.md");
  });
});
