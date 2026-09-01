import type { AgentMetadata } from "@/domains/spec/types.js";

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ClaudeCodePlugin } from "@/domains/spec/services/plugins/claude-code.js";
import { Logger } from "@/views/logger.js";
import { readJsonFile } from "@tests/helpers/read-json.js";

/** A complete AgentMetadata with only the fields a test cares about set. */
function metadata(fields: Partial<AgentMetadata> & { name: string }): AgentMetadata {
  return { description: "", validates: [], excludes: [], exemplars: [], ...fields };
}

describe("ClaudeCodePlugin", () => {
  const dirs: string[] = [];

  function makeTmpdir(): string {
    const dir = join(tmpdir(), `praxis-plugin-test-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    dirs.push(dir);
    return dir;
  }

  afterEach(() => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    dirs.length = 0;
  });

  it("writes agent file to plugins/praxis/agents/", () => {
    const root = makeTmpdir();
    const plugin = new ClaudeCodePlugin({ root, logger: new Logger() });

    plugin.compile(
      "# Role\n\nTest content\n",
      metadata({ name: "tester", description: "A test agent" }),
      "Tester",
    );

    const outputFile = join(root, "plugins", "praxis", "agents", "tester.md");
    expect(existsSync(outputFile)).toBe(true);
  });

  it("prepends Claude Code frontmatter", () => {
    const root = makeTmpdir();
    const plugin = new ClaudeCodePlugin({ root, logger: new Logger() });

    plugin.compile(
      "# Role\n\nTest content\n",
      metadata({ name: "tester", description: "A test agent" }),
      "Tester",
    );

    const content = readFileSync(join(root, "plugins", "praxis", "agents", "tester.md"), "utf-8");
    expect(content).toMatch(/^---\n/);
    expect(content).toContain("name: tester");
    expect(content).toContain("description: A test agent");
    expect(content).toContain("# Role");
  });

  it("includes optional metadata fields", () => {
    const root = makeTmpdir();
    const plugin = new ClaudeCodePlugin({ root, logger: new Logger() });

    plugin.compile(
      "# Role\n\nContent\n",
      metadata({
        name: "tester",
        description: "A test agent",
        tools: "Read, Glob, Grep",
        model: "opus",
        permissionMode: "plan",
      }),
      "Tester",
    );

    const content = readFileSync(join(root, "plugins", "praxis", "agents", "tester.md"), "utf-8");
    expect(content).toContain("tools: Read, Glob, Grep");
    expect(content).toContain("model: opus");
    expect(content).toContain("permissionMode: plan");
  });

  it("writes profile without frontmatter when metadata is null", () => {
    const root = makeTmpdir();
    const plugin = new ClaudeCodePlugin({ root, logger: new Logger() });

    plugin.compile("# Role\n\nContent\n", null, "Tester");

    const content = readFileSync(join(root, "plugins", "praxis", "agents", "tester.md"), "utf-8");
    expect(content).not.toMatch(/^---\n/);
    expect(content).toContain("# Role");
  });

  it("includes paths: in frontmatter when metadata.validates is set", () => {
    const root = makeTmpdir();
    const plugin = new ClaudeCodePlugin({ root, logger: new Logger() });

    plugin.compile(
      "# Role\n\nContent\n",
      metadata({
        name: "servus-expert",
        description: "SME on Servus",
        validates: ["backend/app/services/**/*.rb", "backend/app/events/**/*.rb"],
      }),
      "ServusExpert",
    );

    const content = readFileSync(
      join(root, "plugins", "praxis", "agents", "servusexpert.md"),
      "utf-8",
    );
    expect(content).toContain("paths:");
    expect(content).toContain('  - "backend/app/services/**/*.rb"');
    expect(content).toContain('  - "backend/app/events/**/*.rb"');
  });

  it("omits paths: from frontmatter when metadata.validates is absent", () => {
    const root = makeTmpdir();
    const plugin = new ClaudeCodePlugin({ root, logger: new Logger() });

    plugin.compile(
      "# Role\n\nContent\n",
      metadata({ name: "tester", description: "A test agent" }),
      "Tester",
    );

    const content = readFileSync(join(root, "plugins", "praxis", "agents", "tester.md"), "utf-8");
    expect(content).not.toContain("paths:");
  });

  it("quotes description with special YAML characters", () => {
    const root = makeTmpdir();
    const plugin = new ClaudeCodePlugin({ root, logger: new Logger() });

    plugin.compile(
      "# Role\n\nContent\n",
      metadata({ name: "tester", description: "Use this agent to do: things & stuff [here]" }),
      "Tester",
    );

    const content = readFileSync(join(root, "plugins", "praxis", "agents", "tester.md"), "utf-8");
    expect(content).toContain('description: "Use this agent to do: things & stuff [here]"');
  });

  it("lowercases the alias for the filename", () => {
    const root = makeTmpdir();
    const plugin = new ClaudeCodePlugin({ root, logger: new Logger() });

    plugin.compile("Content", metadata({ name: "stewart", description: "Test" }), "Stewart");

    expect(existsSync(join(root, "plugins", "praxis", "agents", "stewart.md"))).toBe(true);
  });

  it("creates the agents directory if it does not exist", () => {
    const root = makeTmpdir();
    const agentsDir = join(root, "plugins", "praxis", "agents");

    expect(existsSync(agentsDir)).toBe(false);

    const plugin = new ClaudeCodePlugin({ root, logger: new Logger() });
    plugin.compile("Content", null, "test");

    expect(existsSync(agentsDir)).toBe(true);
  });

  it("uses custom outputDir from pluginConfig", () => {
    const root = makeTmpdir();
    const plugin = new ClaudeCodePlugin({
      root,
      logger: new Logger(),
      pluginConfig: { name: "claude-code", outputDir: "./my-plugins/custom" },
    });

    plugin.compile(
      "# Role\n\nContent\n",
      metadata({ name: "tester", description: "Test" }),
      "Tester",
    );

    const outputFile = join(root, "my-plugins", "custom", "agents", "tester.md");
    expect(existsSync(outputFile)).toBe(true);
  });

  it("writes plugin.json to .claude-plugin/ in the output directory", () => {
    const root = makeTmpdir();
    const plugin = new ClaudeCodePlugin({ root, logger: new Logger() });

    plugin.compile("Content", metadata({ name: "tester", description: "Test" }), "Tester");

    const pluginJsonPath = join(root, "plugins", "praxis", ".claude-plugin", "plugin.json");
    expect(existsSync(pluginJsonPath)).toBe(true);

    const pluginJson = readJsonFile<{ name: string }>(pluginJsonPath);
    expect(pluginJson.name).toBe("praxis");
  });

  it("uses custom claudeCodePluginName in plugin.json", () => {
    const root = makeTmpdir();
    const plugin = new ClaudeCodePlugin({
      root,
      logger: new Logger(),
      pluginConfig: { name: "claude-code", claudeCodePluginName: "my-org" },
    });

    plugin.compile("Content", metadata({ name: "tester", description: "Test" }), "Tester");

    const pluginJsonPath = join(root, "plugins", "praxis", ".claude-plugin", "plugin.json");
    const pluginJson = readJsonFile<{ name: string }>(pluginJsonPath);
    expect(pluginJson.name).toBe("my-org");
  });

  it("uses custom outputDir and claudeCodePluginName together", () => {
    const root = makeTmpdir();
    const plugin = new ClaudeCodePlugin({
      root,
      logger: new Logger(),
      pluginConfig: {
        name: "claude-code",
        outputDir: "./my-plugins/custom",
        claudeCodePluginName: "my-org",
      },
    });

    plugin.compile("Content", metadata({ name: "tester", description: "Test" }), "Tester");

    // Agent file in custom output dir
    expect(existsSync(join(root, "my-plugins", "custom", "agents", "tester.md"))).toBe(true);

    // plugin.json in custom output dir with custom name
    const pluginJson = readJsonFile<{ name: string }>(
      join(root, "my-plugins", "custom", ".claude-plugin", "plugin.json"),
    );
    expect(pluginJson.name).toBe("my-org");
  });

  it("updates existing plugin.json preserving user customizations", () => {
    const root = makeTmpdir();

    // Pre-create plugin.json with custom description and author
    const pluginDir = join(root, "plugins", "praxis", ".claude-plugin");
    mkdirSync(pluginDir, { recursive: true });
    writeFileSync(
      join(pluginDir, "plugin.json"),
      JSON.stringify({
        name: "old-name",
        description: "My custom description",
        author: { name: "Custom Author" },
        keywords: ["ai", "agents"],
      }),
    );

    const plugin = new ClaudeCodePlugin({ root, logger: new Logger() });
    plugin.compile("Content", null, "test");

    const pluginJson = readJsonFile<{
      name: string;
      description: string;
      author: { name: string };
      keywords: string[];
    }>(join(pluginDir, "plugin.json"));
    // Name should be updated
    expect(pluginJson.name).toBe("praxis");
    // Custom fields should be preserved
    expect(pluginJson.description).toBe("My custom description");
    expect(pluginJson.author.name).toBe("Custom Author");
    expect(pluginJson.keywords).toEqual(["ai", "agents"]);
  });

  it("writes praxis-resolve command to commands/ directory", () => {
    const root = makeTmpdir();
    const plugin = new ClaudeCodePlugin({ root, logger: new Logger() });

    plugin.compile("Content", metadata({ name: "tester", description: "Test" }), "Tester");

    const commandPath = join(root, "plugins", "praxis", "commands", "praxis-resolve.md");
    expect(existsSync(commandPath)).toBe(true);

    const content = readFileSync(commandPath, "utf-8");
    expect(content).toContain("Iteratively resolve Praxis spec violations");
    expect(content).toContain("$ARGUMENTS");
    expect(content).toContain("praxis eval run");
  });

  it("writes praxis-resolve command to custom outputDir", () => {
    const root = makeTmpdir();
    const plugin = new ClaudeCodePlugin({
      root,
      logger: new Logger(),
      pluginConfig: { name: "claude-code", outputDir: "./my-plugins/custom" },
    });

    plugin.compile("Content", metadata({ name: "tester", description: "Test" }), "Tester");

    const commandPath = join(root, "my-plugins", "custom", "commands", "praxis-resolve.md");
    expect(existsSync(commandPath)).toBe(true);
  });

  it("writes praxis skill to skills/praxis/SKILL.md", () => {
    const root = makeTmpdir();
    const plugin = new ClaudeCodePlugin({ root, logger: new Logger() });

    plugin.compile("Content", metadata({ name: "tester", description: "Test" }), "Tester");

    const skillPath = join(root, "plugins", "praxis", "skills", "praxis", "SKILL.md");
    expect(existsSync(skillPath)).toBe(true);

    const content = readFileSync(skillPath, "utf-8");
    expect(content).toContain("praxis eval");
    expect(content).toContain("praxis compile");
    expect(content).toContain("praxis status");
  });

  it("writes plugin.json only once for multiple compile calls", () => {
    const root = makeTmpdir();
    const plugin = new ClaudeCodePlugin({ root, logger: new Logger() });

    plugin.compile("Content 1", metadata({ name: "a", description: "Agent A" }), "A");
    plugin.compile("Content 2", metadata({ name: "b", description: "Agent B" }), "B");

    // Both agents should exist
    expect(existsSync(join(root, "plugins", "praxis", "agents", "a.md"))).toBe(true);
    expect(existsSync(join(root, "plugins", "praxis", "agents", "b.md"))).toBe(true);
    // plugin.json should exist (written on first compile call)
    expect(existsSync(join(root, "plugins", "praxis", ".claude-plugin", "plugin.json"))).toBe(true);
  });
});
