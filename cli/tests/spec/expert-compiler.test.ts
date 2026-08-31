import type { Logger } from "@/core/logger.js";

import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ExpertCompiler } from "@/spec/expert-compiler.js";
import { createCaptureLogger } from "@tests/helpers/capture-logger.js";
import { createCompilerTmpdir } from "@tests/helpers/compiler-tmpdir.js";

describe("ExpertCompiler", () => {
  let tmpdir: string;
  let expertsDir: string;
  let agentsOutputDir: string;
  let agentProfilesDir: string;
  let cleanup: () => void;
  let logOutput: () => string;
  let logger: Logger;
  let compiler: ExpertCompiler;

  beforeEach(() => {
    const ctx = createCompilerTmpdir();
    tmpdir = ctx.tmpdir;
    expertsDir = ctx.expertsDir;
    agentsOutputDir = ctx.agentsOutputDir;
    agentProfilesDir = ctx.agentProfilesDir;
    cleanup = ctx.cleanup;

    const capture = createCaptureLogger();
    logger = capture.logger;
    logOutput = capture.output;
    compiler = new ExpertCompiler({ root: tmpdir, logger });
  });

  afterEach(() => {
    cleanup();
  });

  describe("compile()", () => {
    it("compiles a single role to agent output and profile", async () => {
      const expertFile = join(expertsDir, "test-expert.md");

      await compiler.compile(expertFile);

      expect(existsSync(join(agentsOutputDir, "tester.md"))).toBe(true);
      expect(existsSync(join(agentProfilesDir, "tester.md"))).toBe(true);
    });

    it("includes the expert body in plugin output", async () => {
      const expertFile = join(expertsDir, "test-expert.md");

      await compiler.compile(expertFile);
      const content = readFileSync(join(agentsOutputDir, "tester.md"), "utf-8");

      expect(content).toContain("# Role");
      expect(content).toContain("A test expert for unit testing");
    });

    it("expands constitution: true to glob all constitution files", async () => {
      const expertFile = join(expertsDir, "test-expert.md");

      await compiler.compile(expertFile);
      const content = readFileSync(join(agentsOutputDir, "tester.md"), "utf-8");

      expect(content).toContain("# Constitution");
      expect(content).toContain("Identity");
      expect(content).toContain("Principles");
    });

    it("includes context section from context frontmatter key", async () => {
      const expertFile = join(expertsDir, "test-expert.md");

      await compiler.compile(expertFile);
      const content = readFileSync(join(agentsOutputDir, "tester.md"), "utf-8");

      expect(content).toContain("# Context");
    });

    it("inlines referenced files (strips their frontmatter)", async () => {
      const expertFile = join(expertsDir, "test-expert.md");

      await compiler.compile(expertFile);
      const content = readFileSync(join(agentsOutputDir, "tester.md"), "utf-8");

      expect(content).toContain("Test Practice");
      expect(content).not.toMatch(/owner: test-expert/);
    });

    it("includes description in Claude Code plugin frontmatter", async () => {
      const expertFile = join(expertsDir, "test-expert.md");

      await compiler.compile(expertFile);
      const content = readFileSync(join(agentsOutputDir, "tester.md"), "utf-8");

      expect(content).toMatch(/^description:/m);
    });

    it("warns when description is missing", async () => {
      const noDesc = join(expertsDir, "no-desc.md");
      writeFileSync(noDesc, "---\nalias: NoDesc\n---\n# Test");

      await compiler.compile(noDesc);

      expect(logOutput()).toContain("No description found");
    });

    it("does not fallback to blockquote for missing description", async () => {
      const withBlockquote = join(expertsDir, "blockquote.md");
      writeFileSync(withBlockquote, "---\nalias: Block\n---\n> Blockquote text");

      await compiler.compile(withBlockquote);
      const content = readFileSync(join(agentsOutputDir, "block.md"), "utf-8");

      expect(content).not.toMatch(/^description: Blockquote text/m);
    });
  });

  describe("cohort frontmatter", () => {
    it("compiles cohort through to the pure profile frontmatter", async () => {
      const expertFile = join(expertsDir, "cohort-expert.md");
      writeFileSync(
        expertFile,
        [
          "---",
          "alias: Grouper",
          "description: judges services by directory",
          "validates:",
          '  - "src/services/*"',
          "cohort: by_directory",
          "---",
          "# Grouper",
        ].join("\n"),
      );

      await compiler.compile(expertFile);
      const profile = readFileSync(join(agentProfilesDir, "grouper.md"), "utf-8");

      expect(profile).toContain("cohort: by_directory");
    });

    it("compiles cohort through to the Claude Code agent frontmatter", async () => {
      const expertFile = join(expertsDir, "cohort-expert.md");
      writeFileSync(
        expertFile,
        [
          "---",
          "alias: Grouper",
          "description: judges services by directory",
          "validates:",
          '  - "src/services/*"',
          "cohort: by_directory",
          "---",
          "# Grouper",
        ].join("\n"),
      );

      await compiler.compile(expertFile);
      const agent = readFileSync(join(agentsOutputDir, "grouper.md"), "utf-8");

      expect(agent).toContain("cohort: by_directory");
    });
  });

  describe("excludes frontmatter", () => {
    /** Writes an expert whose validates: targeting carries an excludes: list. */
    function writeExcludingExpert(): string {
      const expertFile = join(expertsDir, "excluder.md");
      writeFileSync(
        expertFile,
        [
          "---",
          "alias: Excluder",
          "description: judges events, minus the base class",
          "validates:",
          '  - "src/events/*.rb"',
          "excludes:",
          '  - "src/events/application_event.rb"',
          "---",
          "# Excluder",
        ].join("\n"),
      );
      return expertFile;
    }

    it("compiles excludes through to the pure profile frontmatter", async () => {
      await compiler.compile(writeExcludingExpert());
      const profile = readFileSync(join(agentProfilesDir, "excluder.md"), "utf-8");

      expect(profile).toContain("excludes:");
      expect(profile).toContain('- "src/events/application_event.rb"');
    });

    it("compiles excludes through to the Claude Code agent frontmatter", async () => {
      await compiler.compile(writeExcludingExpert());
      const agent = readFileSync(join(agentsOutputDir, "excluder.md"), "utf-8");

      expect(agent).toContain("excludes:");
      expect(agent).toContain('- "src/events/application_event.rb"');
    });
  });

  describe("exemplars frontmatter", () => {
    it("compiles exemplars through to the pure profile frontmatter", async () => {
      const expertFile = join(expertsDir, "blesser.md");
      writeFileSync(
        expertFile,
        [
          "---",
          "alias: Blesser",
          "description: judges events with a golden example",
          "validates:",
          '  - "src/events/*.rb"',
          "exemplars:",
          '  - "src/events/referral_event.rb"',
          "---",
          "# Blesser",
        ].join("\n"),
      );

      await compiler.compile(expertFile);
      const profile = readFileSync(join(agentProfilesDir, "blesser.md"), "utf-8");

      expect(profile).toContain("exemplars:");
      expect(profile).toContain('- "src/events/referral_event.rb"');
    });
  });

  describe("legacy frontmatter", () => {
    it("inlines files listed under the deprecated responsibilities: key", async () => {
      const legacyFile = join(expertsDir, "legacy.md");
      writeFileSync(
        legacyFile,
        [
          "---",
          "alias: Legacy",
          "description: legacy expert",
          "responsibilities:",
          "  - content/practices/test-practice.md",
          "---",
          "# Legacy",
        ].join("\n"),
      );

      await compiler.compile(legacyFile);
      const content = readFileSync(join(agentsOutputDir, "legacy.md"), "utf-8");

      expect(content).toContain("# Responsibilities");
      expect(content).toContain("Test Practice");
    });
  });

  describe("compileAll()", () => {
    it("compiles all roles in the roles directory", async () => {
      const result = await compiler.compileAll();

      expect(result.compiled).toBeGreaterThanOrEqual(1);
    });

    it("skips _template.md files", async () => {
      const template = join(expertsDir, "_template.md");
      writeFileSync(template, "---\nalias: Template\n---\n# Template");

      await compiler.compileAll();

      expect(existsSync(join(agentsOutputDir, "template.md"))).toBe(false);
    });

    it("skips README.md files", async () => {
      await compiler.compileAll();

      expect(existsSync(join(agentsOutputDir, "readme.md"))).toBe(false);
    });

    it("skips roles without alias", async () => {
      const noAlias = join(expertsDir, "no-alias.md");
      writeFileSync(noAlias, "---\ntitle: No Alias\n---\n# No Alias Role");

      const result = await compiler.compileAll();

      expect(result).toBeTypeOf("object");
    });
  });

  describe("config-driven output", () => {
    it("writes pure profiles without frontmatter to agentProfilesDir", async () => {
      const expertFile = join(expertsDir, "test-expert.md");

      await compiler.compile(expertFile);
      const profile = readFileSync(join(agentProfilesDir, "tester.md"), "utf-8");

      // Pure profile has no frontmatter
      expect(profile).not.toMatch(/^---\n/);
      expect(profile).toContain("# Role");
    });

    it("writes Claude Code frontmatter only in plugin output", async () => {
      const expertFile = join(expertsDir, "test-expert.md");

      await compiler.compile(expertFile);

      const pluginOutput = readFileSync(join(agentsOutputDir, "tester.md"), "utf-8");
      const profileOutput = readFileSync(join(agentProfilesDir, "tester.md"), "utf-8");

      expect(pluginOutput).toMatch(/^---\n/);
      expect(pluginOutput).toContain("name: tester");
      expect(profileOutput).not.toContain("name: tester");
    });

    it("skips profile output when agentProfilesOutputDir is false", async () => {
      // Create compiler with profiles disabled
      writeFileSync(
        join(tmpdir, ".praxis", "config.json"),
        JSON.stringify({
          agentProfilesOutputDir: false,
          expertsDir: "content/experts",
          plugins: ["claude-code"],
        }),
      );
      const noProfileCompiler = new ExpertCompiler({ root: tmpdir, logger });
      const expertFile = join(expertsDir, "test-expert.md");

      await noProfileCompiler.compile(expertFile);

      // Plugin output exists, profile dir does not
      expect(existsSync(join(agentsOutputDir, "tester.md"))).toBe(true);
      expect(existsSync(join(agentProfilesDir, "tester.md"))).toBe(false);
    });

    it("skips plugin output when plugins array is empty", async () => {
      // Create compiler with no plugins
      writeFileSync(
        join(tmpdir, ".praxis", "config.json"),
        JSON.stringify({
          agentProfilesOutputDir: "./agent-profiles",
          expertsDir: "content/experts",
          plugins: [],
        }),
      );
      const noPluginCompiler = new ExpertCompiler({ root: tmpdir, logger });
      const expertFile = join(expertsDir, "test-expert.md");

      await noPluginCompiler.compile(expertFile);

      // Profile exists, plugin output does not
      expect(existsSync(join(agentProfilesDir, "tester.md"))).toBe(true);
      expect(existsSync(join(agentsOutputDir, "tester.md"))).toBe(false);
    });
  });

  describe("validates frontmatter", () => {
    it("prepends paths: YAML block to pure profile when validates is set", async () => {
      const expertFile = join(expertsDir, "validates-expert.md");

      await compiler.compile(expertFile);
      const profile = readFileSync(join(agentProfilesDir, "servusexpert.md"), "utf-8");

      expect(profile).toMatch(/^---\n/);
      expect(profile).toContain("paths:");
      expect(profile).toContain('  - "backend/app/services/**/*.rb"');
      expect(profile).toContain('  - "backend/app/events/**/*.rb"');
      expect(profile).toContain("# Servus Expert");
    });

    it("pure profile has no frontmatter when validates is absent", async () => {
      const expertFile = join(expertsDir, "test-expert.md");

      await compiler.compile(expertFile);
      const profile = readFileSync(join(agentProfilesDir, "tester.md"), "utf-8");

      expect(profile).not.toMatch(/^---\n/);
    });

    it("includes paths: in Claude Code plugin frontmatter when validates is set", async () => {
      const expertFile = join(expertsDir, "validates-expert.md");

      await compiler.compile(expertFile);
      const agent = readFileSync(join(agentsOutputDir, "servusexpert.md"), "utf-8");

      expect(agent).toContain("paths:");
      expect(agent).toContain('  - "backend/app/services/**/*.rb"');
      expect(agent).toContain('  - "backend/app/events/**/*.rb"');
    });
  });

  describe("missing ref warnings", () => {
    it("warns when a referenced file does not exist", async () => {
      const expertFile = join(expertsDir, "bad-ref.md");
      writeFileSync(
        expertFile,
        "---\nalias: BadRef\ndescription: test\nrefs:\n  - content/reference/nonexistent.md\n---\n# Bad Ref",
      );

      await compiler.compile(expertFile);

      expect(logOutput()).toContain("Referenced file not found: content/reference/nonexistent.md");
    });

    it("warns when a glob pattern matches zero files", async () => {
      const expertFile = join(expertsDir, "bad-glob.md");
      writeFileSync(
        expertFile,
        "---\nalias: BadGlob\ndescription: test\nrefs:\n  - content/reference/nope-*.md\n---\n# Bad Glob",
      );

      await compiler.compile(expertFile);

      expect(logOutput()).toContain("Glob pattern matched zero files: content/reference/nope-*.md");
    });

    it("warns when constitution: true is deprecated", async () => {
      const expertFile = join(expertsDir, "deprecated-const.md");
      writeFileSync(
        expertFile,
        "---\nalias: DepConst\ndescription: test\nconstitution: true\n---\n# Deprecated Constitution",
      );

      await compiler.compile(expertFile);

      expect(logOutput()).toContain("constitution: true is deprecated");
    });

    it("warns when constitution patterns match zero files", async () => {
      // Remove all constitution files
      rmSync(join(tmpdir, "content", "context", "constitution"), { recursive: true, force: true });

      const expertFile = join(expertsDir, "no-const.md");
      writeFileSync(
        expertFile,
        '---\nalias: NoConst\ndescription: test\nconstitution: "content/context/constitution/*.md"\n---\n# No Constitution',
      );

      await compiler.compile(expertFile);

      expect(logOutput()).toContain("Constitution patterns matched zero files");
    });
  });
});
