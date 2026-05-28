import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

import { initProject } from "@/commands/init.js";
import { Logger } from "@/core/logger.js";

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

describe("initProject", () => {
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
    initProject(dir, logger, SCAFFOLD_DIR);
    expect(existsSync(dir)).toBe(true);
  });

  it("writes all core scaffold files", () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    initProject(dir, logger, SCAFFOLD_DIR);

    const coreDir = join(SCAFFOLD_DIR, "core");
    for (const relPath of walkDir(coreDir)) {
      const fullPath = join(dir, relPath);
      expect(existsSync(fullPath), `expected ${relPath} to exist`).toBe(true);
    }
  });

  it("writes correct content for each core scaffold file", () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    initProject(dir, logger, SCAFFOLD_DIR);

    const coreDir = join(SCAFFOLD_DIR, "core");
    for (const relPath of walkDir(coreDir)) {
      const expected = readFileSync(join(coreDir, relPath), "utf-8");
      const actual = readFileSync(join(dir, relPath), "utf-8");
      expect(actual, `content mismatch for ${relPath}`).toBe(expected);
    }
  });

  it("scaffolds .praxis/config.json", () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    initProject(dir, logger, SCAFFOLD_DIR);

    const configPath = join(dir, ".praxis", "config.json");
    expect(existsSync(configPath)).toBe(true);

    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(config.agentProfilesOutputDir).toBe("./agent-profiles");
    expect(config.plugins).toEqual([]);
    expect(config.sources).toEqual(["roles", "responsibilities", "reference", "context"]);
    expect(config.rolesDir).toBe("roles");
    expect(config.validation).toEqual({
      apiKeyEnvVar: "OPENROUTER_API_KEY",
      model: "x-ai/grok-4.1-fast",
    });
  });

  it("does not scaffold Claude Code files by default", () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    initProject(dir, logger, SCAFFOLD_DIR);

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

    initProject(dir, logger, SCAFFOLD_DIR);

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

    initProject(dir, logger, SCAFFOLD_DIR);

    const pluginJson = JSON.parse(
      readFileSync(join(dir, "plugins", "praxis", ".claude-plugin", "plugin.json"), "utf-8"),
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

    initProject(dir, logger, SCAFFOLD_DIR);

    const pluginJsonPath = join(dir, "my-plugins", "custom", ".claude-plugin", "plugin.json");
    expect(existsSync(pluginJsonPath)).toBe(true);

    const pluginJson = JSON.parse(readFileSync(pluginJsonPath, "utf-8"));
    expect(pluginJson.name).toBe("my-org");
  });

  it("skips files that already exist", () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    // Pre-create the README with custom content
    mkdirSync(dir, { recursive: true });
    const readmePath = join(dir, "README.md");
    writeFileSync(readmePath, "# My Custom README\n");

    initProject(dir, logger, SCAFFOLD_DIR);

    // Verify our custom content was preserved, not overwritten
    const content = readFileSync(readmePath, "utf-8");
    expect(content).toBe("# My Custom README\n");
  });

  it("is idempotent — second run skips all files", () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    initProject(dir, logger, SCAFFOLD_DIR);

    // Modify one file to verify it's not overwritten
    const readmePath = join(dir, "README.md");
    writeFileSync(readmePath, "modified");

    initProject(dir, logger, SCAFFOLD_DIR);

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

    initProject(dir, logger, SCAFFOLD_DIR);

    // Scaffold files exist
    expect(existsSync(join(dir, "roles", "README.md"))).toBe(true);

    // Unrelated files preserved
    expect(readFileSync(join(dir, "src", "app.ts"), "utf-8")).toBe("console.log('hello');\n");
    expect(readFileSync(join(dir, "package.json"), "utf-8")).toBe('{ "name": "my-app" }\n');
  });

  it("creates all expected core directories", () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    initProject(dir, logger, SCAFFOLD_DIR);

    const expectedDirs = [
      "context/constitution",
      "context/conventions",
      "context/lenses",
      "roles",
      "responsibilities",
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

    initProject(dir, logger, SCAFFOLD_DIR);

    expect(
      existsSync(join(dir, "plugins", "praxis", ".claude-plugin")),
      "expected plugins/praxis/.claude-plugin to exist",
    ).toBe(true);
  });
});
