import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { CommandContext } from "@/models/command-context.js";
import { initProjectOrchestrator } from "@/orchestrators/init-project-orchestrator.js";
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

describe("initProjectOrchestrator", () => {
  // initProjectOrchestrator scaffolds a directory that has no project yet, so it never
  // reads root or config off the context.
  const ctx = new CommandContext();

  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    dirs.length = 0;
  });

  it("creates target directory if it does not exist", async () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    expect(existsSync(dir)).toBe(false);
    await initProjectOrchestrator(ctx, { directory: dir, scaffoldDir: SCAFFOLD_DIR });
    expect(existsSync(dir)).toBe(true);
  });

  it("writes all spec-layer scaffold files with --spec-layer", async () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    await initProjectOrchestrator(ctx, {
      directory: dir,
      scaffoldDir: SCAFFOLD_DIR,
      specLayer: true,
    });

    const coreDir = join(SCAFFOLD_DIR, "core");
    for (const relPath of walkDir(coreDir)) {
      const fullPath = join(dir, relPath);
      expect(existsSync(fullPath), `expected ${relPath} to exist`).toBe(true);
    }
  });

  it("writes correct content for each spec-layer scaffold file", async () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    await initProjectOrchestrator(ctx, {
      directory: dir,
      scaffoldDir: SCAFFOLD_DIR,
      specLayer: true,
    });

    const coreDir = join(SCAFFOLD_DIR, "core");
    for (const relPath of walkDir(coreDir)) {
      const expected = readFileSync(join(coreDir, relPath), "utf-8");
      const actual = readFileSync(join(dir, relPath), "utf-8");
      expect(actual, `content mismatch for ${relPath}`).toBe(expected);
    }
  });

  it("scaffolds the full taxonomy config with --spec-layer", async () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    await initProjectOrchestrator(ctx, {
      directory: dir,
      scaffoldDir: SCAFFOLD_DIR,
      specLayer: true,
    });

    const configPath = join(dir, ".praxis", "config.json");
    expect(existsSync(configPath)).toBe(true);

    const config = readJsonFile<{
      agentProfilesOutputDir: string;
      plugins: string[];
      sources: string[];
      expertsDir: string;
      practicesDir: string;
      reviewers: { name: string; model: string; apiKeyEnvVar: string }[];
    }>(configPath);
    expect(config.agentProfilesOutputDir).toBe("./agent-profiles");
    expect(config.plugins).toEqual([]);
    expect(config.sources).toEqual(["experts", "practices", "reference", "context"]);
    expect(config.expertsDir).toBe("experts");
    expect(config.reviewers).toEqual([
      { name: "default", model: "x-ai/grok-4.1-fast", apiKeyEnvVar: "OPENROUTER_API_KEY" },
    ]);
  });

  it("scaffolds only the eval-layer .praxis tree by default", async () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    await initProjectOrchestrator(ctx, { directory: dir, scaffoldDir: SCAFFOLD_DIR });

    expect(walkDir(dir)).toEqual([join(".praxis", "config.json")]);
  });

  it("default eval-layer config declares reviewers and empty sources", async () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    await initProjectOrchestrator(ctx, { directory: dir, scaffoldDir: SCAFFOLD_DIR });

    const config = readJsonFile<{
      sources: string[];
      specFilePattern: string;
      reviewers: { name: string }[];
      expertsDir?: string;
    }>(join(dir, ".praxis", "config.json"));
    expect(config.sources).toEqual([]);
    expect(config.specFilePattern).toBe("README.md");
    expect(config.reviewers).toHaveLength(1);
    // No taxonomy keys: the spec layer is opt-in.
    expect(config.expertsDir).toBeUndefined();
  });

  it("does not scaffold Claude Code files by default", async () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    await initProjectOrchestrator(ctx, { directory: dir, scaffoldDir: SCAFFOLD_DIR });

    // init seeds a project; plugin output (plugins/praxis) is compile's job
    expect(existsSync(join(dir, "plugins", "praxis"))).toBe(false);
  });

  it("skips files that already exist", async () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    // Pre-create the config with custom content
    mkdirSync(join(dir, ".praxis"), { recursive: true });
    const configPath = join(dir, ".praxis", "config.json");
    writeFileSync(configPath, '{ "sources": ["docs"] }');

    await initProjectOrchestrator(ctx, { directory: dir, scaffoldDir: SCAFFOLD_DIR });

    // Verify our custom content was preserved, not overwritten
    expect(readFileSync(configPath, "utf-8")).toBe('{ "sources": ["docs"] }');
  });

  it("is idempotent — second run skips all files", async () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    await initProjectOrchestrator(ctx, {
      directory: dir,
      scaffoldDir: SCAFFOLD_DIR,
      specLayer: true,
    });

    // Modify one file to verify it's not overwritten
    const readmePath = join(dir, "README.md");
    writeFileSync(readmePath, "modified");

    await initProjectOrchestrator(ctx, {
      directory: dir,
      scaffoldDir: SCAFFOLD_DIR,
      specLayer: true,
    });

    const content = readFileSync(readmePath, "utf-8");
    expect(content).toBe("modified");
  });

  it("works in a non-empty directory with unrelated files", async () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    // Pre-populate with unrelated files
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "app.ts"), "console.log('hello');\n");
    writeFileSync(join(dir, "package.json"), '{ "name": "my-app" }\n');

    await initProjectOrchestrator(ctx, {
      directory: dir,
      scaffoldDir: SCAFFOLD_DIR,
      specLayer: true,
    });

    // Scaffold files exist
    expect(existsSync(join(dir, "experts", "README.md"))).toBe(true);

    // Unrelated files preserved
    expect(readFileSync(join(dir, "src", "app.ts"), "utf-8")).toBe("console.log('hello');\n");
    expect(readFileSync(join(dir, "package.json"), "utf-8")).toBe('{ "name": "my-app" }\n');
  });

  it("creates all expected spec-layer directories with --spec-layer", async () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    await initProjectOrchestrator(ctx, {
      directory: dir,
      scaffoldDir: SCAFFOLD_DIR,
      specLayer: true,
    });

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
});
