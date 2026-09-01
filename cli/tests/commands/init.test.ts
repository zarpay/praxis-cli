import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { InitCommand } from "@/commands/init.js";
import { Logger } from "@/views/logger.js";
import { readJsonFile } from "@tests/helpers/read-json.js";

/** Resolved path to the scaffold directory at the project root. */
const SCAFFOLD_DIR = join(import.meta.dirname, "..", "..", "scaffold");

/** Creates a fresh temporary directory for each test. */
function makeTmpdir(): string {
  return join(tmpdir(), `praxis-init-test-${randomUUID()}`);
}

/**
 * Recursively walks a directory and returns sorted relative file paths.
 */
function walkDir(dir: string, base = dir): string[] {
  const results: string[] = [];

  if (!existsSync(dir)) return results;

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);

    if (statSync(fullPath).isDirectory()) {
      results.push(...walkDir(fullPath, base));
    } else {
      results.push(relative(base, fullPath));
    }
  }
  return results.sort();
}

describe("InitCommand", () => {
  const dirs: string[] = [];
  const logger = new Logger();

  afterEach(() => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    dirs.length = 0;
  });

  it("creates target directory if it does not exist", () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    expect(existsSync(dir)).toBe(false);
    new InitCommand({ targetDir: dir, scaffoldDir: SCAFFOLD_DIR, logger }).init();
    expect(existsSync(dir)).toBe(true);
  });

  it("writes all spec-layer scaffold files with --spec-layer", () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    new InitCommand({ targetDir: dir, scaffoldDir: SCAFFOLD_DIR, logger, specLayer: true }).init();

    const coreDir = join(SCAFFOLD_DIR, "core");
    for (const relPath of walkDir(coreDir)) {
      const fullPath = join(dir, relPath);
      expect(existsSync(fullPath), `expected ${relPath} to exist`).toBe(true);
    }
  });

  it("writes correct content for each spec-layer scaffold file", () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    new InitCommand({ targetDir: dir, scaffoldDir: SCAFFOLD_DIR, logger, specLayer: true }).init();

    const coreDir = join(SCAFFOLD_DIR, "core");
    for (const relPath of walkDir(coreDir)) {
      const expected = readFileSync(join(coreDir, relPath), "utf-8");
      const actual = readFileSync(join(dir, relPath), "utf-8");
      expect(actual, `content mismatch for ${relPath}`).toBe(expected);
    }
  });

  it("scaffolds the full taxonomy config with --spec-layer", () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    new InitCommand({ targetDir: dir, scaffoldDir: SCAFFOLD_DIR, logger, specLayer: true }).init();

    const configPath = join(dir, ".praxis", "config.json");
    expect(existsSync(configPath)).toBe(true);

    const config = readJsonFile<{
      agentProfilesOutputDir: string;
      plugins: string[];
      sources: string[];
      expertsDir: string;
      practicesDir: string;
      judges: { name: string; model: string; apiKeyEnvVar: string }[];
    }>(configPath);
    expect(config.agentProfilesOutputDir).toBe("./agent-profiles");
    expect(config.plugins).toEqual([]);
    expect(config.sources).toEqual(["experts", "practices", "reference", "context"]);
    expect(config.expertsDir).toBe("experts");
    expect(config.judges).toEqual([
      { name: "default", model: "x-ai/grok-4.1-fast", apiKeyEnvVar: "OPENROUTER_API_KEY" },
    ]);
  });

  it("scaffolds only the eval-layer .praxis tree by default", () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    new InitCommand({ targetDir: dir, scaffoldDir: SCAFFOLD_DIR, logger }).init();

    expect(walkDir(dir)).toEqual([join(".praxis", "config.json")]);
  });

  it("default eval-layer config declares judges and empty sources", () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    new InitCommand({ targetDir: dir, scaffoldDir: SCAFFOLD_DIR, logger }).init();

    const config = readJsonFile<{
      sources: string[];
      specFilePattern: string;
      judges: { name: string }[];
      expertsDir?: string;
    }>(join(dir, ".praxis", "config.json"));
    expect(config.sources).toEqual([]);
    expect(config.specFilePattern).toBe("README.md");
    expect(config.judges).toHaveLength(1);
    // No taxonomy keys: the spec layer is opt-in.
    expect(config.expertsDir).toBeUndefined();
  });

  it("does not scaffold Claude Code files by default", () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    new InitCommand({ targetDir: dir, scaffoldDir: SCAFFOLD_DIR, logger }).init();

    // Default config has plugins: [], so no Claude Code files
    expect(existsSync(join(dir, "plugins", "praxis"))).toBe(false);
  });

  it("scaffolds Claude Code files when plugin is in config as string", () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    // Pre-create config with claude-code plugin enabled
    mkdirSync(join(dir, ".praxis"), { recursive: true });
    writeFileSync(
      join(dir, ".praxis", "config.json"),
      JSON.stringify({ agentProfilesOutputDir: "./agent-profiles", plugins: ["claude-code"] }),
    );

    new InitCommand({ targetDir: dir, scaffoldDir: SCAFFOLD_DIR, logger }).init();

    // Default outputDir is plugins/praxis
    expect(existsSync(join(dir, "plugins", "praxis", ".claude-plugin", "plugin.json"))).toBe(true);
  });

  it("templates {claudeCodePluginName} in plugin.json during scaffold", () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    mkdirSync(join(dir, ".praxis"), { recursive: true });
    writeFileSync(
      join(dir, ".praxis", "config.json"),
      JSON.stringify({ plugins: ["claude-code"] }),
    );

    new InitCommand({ targetDir: dir, scaffoldDir: SCAFFOLD_DIR, logger }).init();

    const pluginJson = readJsonFile<{ name: string }>(
      join(dir, "plugins", "praxis", ".claude-plugin", "plugin.json"),
    );
    // Default claudeCodePluginName is "praxis"
    expect(pluginJson.name).toBe("praxis");
    // Should not contain the raw template variable
    expect(JSON.stringify(pluginJson)).not.toContain("{claudeCodePluginName}");
  });

  it("scaffolds Claude Code files to custom outputDir when specified", () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    mkdirSync(join(dir, ".praxis"), { recursive: true });
    writeFileSync(
      join(dir, ".praxis", "config.json"),
      JSON.stringify({
        plugins: [
          {
            name: "claude-code",
            outputDir: "./my-plugins/custom",
            claudeCodePluginName: "my-org",
          },
        ],
      }),
    );

    new InitCommand({ targetDir: dir, scaffoldDir: SCAFFOLD_DIR, logger }).init();

    const pluginJsonPath = join(dir, "my-plugins", "custom", ".claude-plugin", "plugin.json");
    expect(existsSync(pluginJsonPath)).toBe(true);

    const pluginJson = readJsonFile<{ name: string }>(pluginJsonPath);
    expect(pluginJson.name).toBe("my-org");
  });

  it("skips files that already exist", () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    // Pre-create the config with custom content
    mkdirSync(join(dir, ".praxis"), { recursive: true });
    const configPath = join(dir, ".praxis", "config.json");
    writeFileSync(configPath, '{ "sources": ["docs"] }');

    new InitCommand({ targetDir: dir, scaffoldDir: SCAFFOLD_DIR, logger }).init();

    // Verify our custom content was preserved, not overwritten
    expect(readFileSync(configPath, "utf-8")).toBe('{ "sources": ["docs"] }');
  });

  it("is idempotent — second run skips all files", () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    new InitCommand({ targetDir: dir, scaffoldDir: SCAFFOLD_DIR, logger, specLayer: true }).init();

    // Modify one file to verify it's not overwritten
    const readmePath = join(dir, "README.md");
    writeFileSync(readmePath, "modified");

    new InitCommand({ targetDir: dir, scaffoldDir: SCAFFOLD_DIR, logger, specLayer: true }).init();

    const content = readFileSync(readmePath, "utf-8");
    expect(content).toBe("modified");
  });

  it("works in a non-empty directory with unrelated files", () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    // Pre-populate with unrelated files
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "app.ts"), "console.log('hello');\n");
    writeFileSync(join(dir, "package.json"), '{ "name": "my-app" }\n');

    new InitCommand({ targetDir: dir, scaffoldDir: SCAFFOLD_DIR, logger, specLayer: true }).init();

    // Scaffold files exist
    expect(existsSync(join(dir, "experts", "README.md"))).toBe(true);

    // Unrelated files preserved
    expect(readFileSync(join(dir, "src", "app.ts"), "utf-8")).toBe("console.log('hello');\n");
    expect(readFileSync(join(dir, "package.json"), "utf-8")).toBe('{ "name": "my-app" }\n');
  });

  it("creates all expected spec-layer directories with --spec-layer", () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    new InitCommand({ targetDir: dir, scaffoldDir: SCAFFOLD_DIR, logger, specLayer: true }).init();

    const expectedDirs = [
      "context/constitution",
      "context/conventions",
      "context/lenses",
      "experts",
      "practices",
      "reference",
    ];

    for (const expected of expectedDirs) {
      expect(existsSync(join(dir, expected)), `expected directory ${expected} to exist`).toBe(true);
    }
  });

  it("creates Claude Code plugin directory when enabled", () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    mkdirSync(join(dir, ".praxis"), { recursive: true });
    writeFileSync(
      join(dir, ".praxis", "config.json"),
      JSON.stringify({ plugins: ["claude-code"] }),
    );

    new InitCommand({ targetDir: dir, scaffoldDir: SCAFFOLD_DIR, logger }).init();

    expect(
      existsSync(join(dir, "plugins", "praxis", ".claude-plugin")),
      "expected plugins/praxis/.claude-plugin to exist",
    ).toBe(true);
  });
});
