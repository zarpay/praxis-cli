import type { CompileScope } from "@/types.js";
import type { Logger } from "@framework/views/logger.js";

import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PraxisConfig } from "@/models/praxis-config.js";
import compileExpert from "@/services/compile-expert-service.js";
import compileExperts from "@/services/compile-experts-service.js";
import resolvePlugins from "@/services/resolve-plugins-service.js";
import { createCaptureLogger } from "@tests/helpers/capture-logger.js";
import { createCompilerTmpdir } from "@tests/helpers/compiler-tmpdir.js";

describe("compileExperts", () => {
  let tmpdir: string;
  let expertsDir: string;
  let agentsOutputDir: string;
  let agentProfilesDir: string;
  let cleanup: () => void;
  let logOutput: () => string;
  let logger: Logger;
  let scope: CompileScope;

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
    const config = new PraxisConfig(tmpdir);
    scope = {
      root: tmpdir,
      specFilePattern: config.specFilePattern,
      agentProfilesOutputDir: config.agentProfilesOutputDir,
      plugins: resolvePlugins(config.plugins, tmpdir, logger),
    };
  });

  /** Compiles one expert, routing its warnings to the capture logger. */
  async function compileFile(expertFile: string) {
    const result = await compileExpert({ ...scope, expertFile });

    for (const message of result.warnings) logger.warn(message);

    return result;
  }

  /** Compiles every expert, routing warnings and skips to the capture logger. */
  async function compileAll() {
    return compileExperts({
      ...scope,
      expertsDir,
      onProgress: (event) => {
        if (event.kind === "warning") logger.warn(event.message);
        else if (event.kind === "skipped") logger.warn(`Skipping ${event.file}: ${event.reason}`);
      },
    });
  }

  afterEach(() => {
    cleanup();
  });

  describe("compile()", () => {
    it("compiles a single role to agent output and profile", async () => {
      const expertFile = join(expertsDir, "test-expert.md");

      await compileFile(expertFile);

      expect(existsSync(join(agentsOutputDir, "tester.md"))).toBe(true);
      expect(existsSync(join(agentProfilesDir, "tester.md"))).toBe(true);
    });

    it("includes the expert body in plugin output", async () => {
      const expertFile = join(expertsDir, "test-expert.md");

      await compileFile(expertFile);
      const content = readFileSync(join(agentsOutputDir, "tester.md"), "utf-8");

      expect(content).toContain("# Role");
      expect(content).toContain("A test expert for unit testing");
    });

    it("expands constitution: true to glob all constitution files", async () => {
      const expertFile = join(expertsDir, "test-expert.md");

      await compileFile(expertFile);
      const content = readFileSync(join(agentsOutputDir, "tester.md"), "utf-8");

      expect(content).toContain("# Constitution");
      expect(content).toContain("Identity");
      expect(content).toContain("Principles");
    });

    it("includes context section from context frontmatter key", async () => {
      const expertFile = join(expertsDir, "test-expert.md");

      await compileFile(expertFile);
      const content = readFileSync(join(agentsOutputDir, "tester.md"), "utf-8");

      expect(content).toContain("# Context");
    });

    it("inlines referenced files (strips their frontmatter)", async () => {
      const expertFile = join(expertsDir, "test-expert.md");

      await compileFile(expertFile);
      const content = readFileSync(join(agentsOutputDir, "tester.md"), "utf-8");

      expect(content).toContain("Test Practice");
      expect(content).not.toMatch(/owner: test-expert/);
    });

    it("includes description in Claude Code plugin frontmatter", async () => {
      const expertFile = join(expertsDir, "test-expert.md");

      await compileFile(expertFile);
      const content = readFileSync(join(agentsOutputDir, "tester.md"), "utf-8");

      expect(content).toMatch(/^description:/m);
    });

    it("warns when description is missing", async () => {
      const noDesc = join(expertsDir, "no-desc.md");
      writeFileSync(noDesc, "---\nalias: NoDesc\n---\n# Test");

      await compileFile(noDesc);

      expect(logOutput()).toContain("No description found");
    });

    it("does not fallback to blockquote for missing description", async () => {
      const withBlockquote = join(expertsDir, "blockquote.md");
      writeFileSync(withBlockquote, "---\nalias: Block\n---\n> Blockquote text");

      await compileFile(withBlockquote);
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
          "description: reviewers services by directory",
          "validates:",
          '  - "src/services/*"',
          "cohort: by_directory",
          "---",
          "# Grouper",
        ].join("\n"),
      );

      await compileFile(expertFile);
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
          "description: reviewers services by directory",
          "validates:",
          '  - "src/services/*"',
          "cohort: by_directory",
          "---",
          "# Grouper",
        ].join("\n"),
      );

      await compileFile(expertFile);
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
          "description: reviewers events, minus the base class",
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
      await compileFile(writeExcludingExpert());
      const profile = readFileSync(join(agentProfilesDir, "excluder.md"), "utf-8");

      expect(profile).toContain("excludes:");
      expect(profile).toContain('- "src/events/application_event.rb"');
    });

    it("compiles excludes through to the Claude Code agent frontmatter", async () => {
      await compileFile(writeExcludingExpert());
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
          "description: reviewers events with a golden example",
          "validates:",
          '  - "src/events/*.rb"',
          "exemplars:",
          '  - "src/events/referral_event.rb"',
          "---",
          "# Blesser",
        ].join("\n"),
      );

      await compileFile(expertFile);
      const profile = readFileSync(join(agentProfilesDir, "blesser.md"), "utf-8");

      expect(profile).toContain("exemplars:");
      expect(profile).toContain('- "src/events/referral_event.rb"');
    });
  });

  describe("agent_* frontmatter", () => {
    it("compiles agent_tools, agent_model and agent_permission_mode into the agent frontmatter", async () => {
      const expertFile = join(expertsDir, "tuned-expert.md");
      writeFileSync(
        expertFile,
        [
          "---",
          "alias: Tuned",
          "description: an expert with agent settings",
          "agent_tools: Read, Glob, Grep",
          "agent_model: opus",
          "agent_permission_mode: plan",
          "---",
          "# Tuned",
        ].join("\n"),
      );

      await compileFile(expertFile);
      const agent = readFileSync(join(agentsOutputDir, "tuned.md"), "utf-8");

      expect(agent).toContain("tools: Read, Glob, Grep");
      expect(agent).toContain("model: opus");
      expect(agent).toContain("permissionMode: plan");
    });

    it("omits the agent settings absent from the frontmatter", async () => {
      const expertFile = join(expertsDir, "plain-expert.md");
      writeFileSync(
        expertFile,
        [
          "---",
          "alias: Plain",
          "description: an expert with no agent settings",
          "---",
          "# Plain",
        ].join("\n"),
      );

      await compileFile(expertFile);
      const agent = readFileSync(join(agentsOutputDir, "plain.md"), "utf-8");

      expect(agent).not.toContain("tools:");
      expect(agent).not.toContain("model:");
      expect(agent).not.toContain("permissionMode:");
    });
  });

  describe("template skipping", () => {
    it("never compiles underscore-prefixed files, whatever their name", async () => {
      const templateFile = join(expertsDir, "_expert-template.md");
      writeFileSync(
        templateFile,
        ["---", "alias: Todo", "description: placeholder", "---", "# TODO"].join("\n"),
      );

      await compileAll();

      expect(existsSync(join(agentProfilesDir, "todo.md"))).toBe(false);
    });
  });

  describe("compileAll()", () => {
    it("compiles all roles in the roles directory", async () => {
      const result = await compileAll();

      expect(result.compiled).toBeGreaterThanOrEqual(1);
    });

    it("skips _template.md files", async () => {
      const template = join(expertsDir, "_template.md");
      writeFileSync(template, "---\nalias: Template\n---\n# Template");

      await compileAll();

      expect(existsSync(join(agentsOutputDir, "template.md"))).toBe(false);
    });

    it("skips README.md files", async () => {
      await compileAll();

      expect(existsSync(join(agentsOutputDir, "readme.md"))).toBe(false);
    });

    it("skips roles without alias", async () => {
      const noAlias = join(expertsDir, "no-alias.md");
      writeFileSync(noAlias, "---\ntitle: No Alias\n---\n# No Alias Role");

      const result = await compileAll();

      expect(result).toBeTypeOf("object");
    });

    it("keeps compiling the rest when one expert is malformed", async () => {
      const broken = join(expertsDir, "broken.md");
      writeFileSync(broken, "---\nalias: Broken\nagent_tools:\n  - Read\n---\n# Broken");

      const result = await compileAll();

      expect(result.compiled).toBeGreaterThanOrEqual(1);
      expect(existsSync(join(agentsOutputDir, "broken.md"))).toBe(false);
    });
  });

  describe("config-driven output", () => {
    it("writes pure profiles without frontmatter to agentProfilesDir", async () => {
      const expertFile = join(expertsDir, "test-expert.md");

      await compileFile(expertFile);
      const profile = readFileSync(join(agentProfilesDir, "tester.md"), "utf-8");

      // Pure profile has no frontmatter
      expect(profile).not.toMatch(/^---\n/);
      expect(profile).toContain("# Role");
    });

    it("writes Claude Code frontmatter only in plugin output", async () => {
      const expertFile = join(expertsDir, "test-expert.md");

      await compileFile(expertFile);

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
      const reloaded = new PraxisConfig(tmpdir);
      const expertFile = join(expertsDir, "test-expert.md");

      await compileExpert({
        expertFile,
        root: tmpdir,
        specFilePattern: reloaded.specFilePattern,
        agentProfilesOutputDir: reloaded.agentProfilesOutputDir,
        plugins: resolvePlugins(reloaded.plugins, tmpdir, logger),
      });

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
      const reloaded = new PraxisConfig(tmpdir);
      const expertFile = join(expertsDir, "test-expert.md");

      await compileExpert({
        expertFile,
        root: tmpdir,
        specFilePattern: reloaded.specFilePattern,
        agentProfilesOutputDir: reloaded.agentProfilesOutputDir,
        plugins: resolvePlugins(reloaded.plugins, tmpdir, logger),
      });

      // Profile exists, plugin output does not
      expect(existsSync(join(agentProfilesDir, "tester.md"))).toBe(true);
      expect(existsSync(join(agentsOutputDir, "tester.md"))).toBe(false);
    });
  });

  describe("validates frontmatter", () => {
    it("prepends paths: YAML block to pure profile when validates is set", async () => {
      const expertFile = join(expertsDir, "validates-expert.md");

      await compileFile(expertFile);
      const profile = readFileSync(join(agentProfilesDir, "servusexpert.md"), "utf-8");

      expect(profile).toMatch(/^---\n/);
      expect(profile).toContain("paths:");
      expect(profile).toContain('  - "backend/app/services/**/*.rb"');
      expect(profile).toContain('  - "backend/app/events/**/*.rb"');
      expect(profile).toContain("# Servus Expert");
    });

    it("pure profile has no frontmatter when validates is absent", async () => {
      const expertFile = join(expertsDir, "test-expert.md");

      await compileFile(expertFile);
      const profile = readFileSync(join(agentProfilesDir, "tester.md"), "utf-8");

      expect(profile).not.toMatch(/^---\n/);
    });

    it("includes paths: in Claude Code plugin frontmatter when validates is set", async () => {
      const expertFile = join(expertsDir, "validates-expert.md");

      await compileFile(expertFile);
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

      await compileFile(expertFile);

      expect(logOutput()).toContain("Referenced file not found: content/reference/nonexistent.md");
    });

    it("warns when a glob pattern matches zero files", async () => {
      const expertFile = join(expertsDir, "bad-glob.md");
      writeFileSync(
        expertFile,
        "---\nalias: BadGlob\ndescription: test\nrefs:\n  - content/reference/nope-*.md\n---\n# Bad Glob",
      );

      await compileFile(expertFile);

      expect(logOutput()).toContain("Glob pattern matched zero files: content/reference/nope-*.md");
    });

    it("warns when constitution patterns match zero files", async () => {
      // Remove all constitution files
      rmSync(join(tmpdir, "content", "context", "constitution"), { recursive: true, force: true });

      const expertFile = join(expertsDir, "no-const.md");
      writeFileSync(
        expertFile,
        '---\nalias: NoConst\ndescription: test\nconstitution: "content/context/constitution/*.md"\n---\n# No Constitution',
      );

      await compileFile(expertFile);

      expect(logOutput()).toContain("Constitution patterns matched zero files");
    });
  });
});
