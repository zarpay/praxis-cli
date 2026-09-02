import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import compileExperts from "@/domains/spec/services/compile-experts.js";
import resolvePlugins from "@/domains/spec/services/resolve-plugins.js";
import { CommandContext } from "@/domains/workspace/models/command-context.js";
import { PraxisConfig } from "@/domains/workspace/models/praxis-config.js";
import { initProject } from "@/domains/workspace/orchestrators/init-project.js";
import { Logger } from "@/views/logger.js";
import { readJsonFile } from "@tests/helpers/read-json.js";

/** Resolved path to the scaffold directory at the project root. */
const SCAFFOLD_DIR = join(import.meta.dirname, "..", "..", "scaffold");

/**
 * Integration test: init → compile → verify output.
 *
 * Scaffolds a fresh Praxis project via InitCommand, enables the
 * claude-code plugin via config, runs the compiler, and verifies
 * that agent files are produced with the expected structure.
 */
describe("init → compile integration", () => {
  let dir: string;
  const logger = new Logger();

  beforeAll(async () => {
    dir = join(tmpdir(), `praxis-integration-${randomUUID()}`);

    // Scaffold the project (creates .praxis/ which Paths uses for root detection)
    await initProject(new CommandContext(), {
      directory: dir,
      scaffoldDir: SCAFFOLD_DIR,
      specLayer: true,
    });

    // Enable claude-code plugin in config
    writeFileSync(
      join(dir, ".praxis", "config.json"),
      JSON.stringify({
        sources: ["experts", "practices", "reference", "context"],
        expertsDir: "experts",
        practicesDir: "practices",
        agentProfilesOutputDir: "./agent-profiles",
        plugins: ["claude-code"],
      }),
    );

    // Compile all roles
    const config = new PraxisConfig(dir);
    await compileExperts({
      root: dir,
      expertsDir: config.expertsDir,
      specFilePattern: config.specFilePattern,
      agentProfilesOutputDir: config.agentProfilesOutputDir,
      plugins: resolvePlugins(config.plugins, dir, logger),
    });
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("produces stewart.md Claude Code agent file", () => {
    const agentFile = join(dir, "plugins", "praxis", "agents", "stewart.md");
    expect(existsSync(agentFile)).toBe(true);
  });

  it("produces remy.md Claude Code agent file", () => {
    const agentFile = join(dir, "plugins", "praxis", "agents", "remy.md");
    expect(existsSync(agentFile)).toBe(true);
  });

  it("produces exactly 2 Claude Code agent files", () => {
    const agentsDir = join(dir, "plugins", "praxis", "agents");
    const files = readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
    expect(files).toHaveLength(2);
  });

  it("produces plugin.json in the plugin directory", () => {
    const pluginJsonPath = join(dir, "plugins", "praxis", ".claude-plugin", "plugin.json");
    expect(existsSync(pluginJsonPath)).toBe(true);

    const pluginJson = readJsonFile<{ name: string }>(pluginJsonPath);
    expect(pluginJson.name).toBe("praxis");
  });

  it("produces exactly 2 pure agent profile files", () => {
    const profilesDir = join(dir, "agent-profiles");
    const files = readdirSync(profilesDir).filter((f) => f.endsWith(".md"));
    expect(files).toHaveLength(2);
  });

  it("pure profiles do not contain Claude Code frontmatter", () => {
    const content = readFileSync(join(dir, "agent-profiles", "stewart.md"), "utf-8");
    expect(content).not.toMatch(/^---\n/);
    expect(content).not.toContain("name: stewart");
    expect(content).toContain("# Role");
  });

  it("stewart agent has Claude Code frontmatter", () => {
    const content = readFileSync(join(dir, "plugins", "praxis", "agents", "stewart.md"), "utf-8");
    expect(content).toMatch(/^---\n/);
    expect(content).toContain("name: stewart");
    expect(content).toContain("description:");
  });

  it("remy agent has Claude Code frontmatter", () => {
    const content = readFileSync(join(dir, "plugins", "praxis", "agents", "remy.md"), "utf-8");
    expect(content).toMatch(/^---\n/);
    expect(content).toContain("name: remy");
    expect(content).toContain("description:");
  });

  it("stewart agent contains role section", () => {
    const content = readFileSync(join(dir, "plugins", "praxis", "agents", "stewart.md"), "utf-8");
    expect(content).toContain("# Role");
    expect(content).toContain("Praxis Steward");
  });

  it("stewart agent contains inlined responsibilities", () => {
    const content = readFileSync(join(dir, "plugins", "praxis", "agents", "stewart.md"), "utf-8");
    expect(content).toContain("# Responsibilities");
    // Stewart references guide-content-placement, review-content-quality, audit-framework-health
    expect(content).toContain("Guide Content Placement");
    expect(content).toContain("Review Content Quality");
    expect(content).toContain("Audit Framework Health");
  });

  it("stewart agent contains inlined constitution", () => {
    const content = readFileSync(join(dir, "plugins", "praxis", "agents", "stewart.md"), "utf-8");
    expect(content).toContain("# Constitution");
  });

  it("stewart agent contains inlined reference", () => {
    const content = readFileSync(join(dir, "plugins", "praxis", "agents", "stewart.md"), "utf-8");
    expect(content).toContain("# Reference");
    expect(content).toContain("Praxis Vocabulary");
  });

  it("compiled agents do not contain raw frontmatter blocks from inlined files", () => {
    const content = readFileSync(join(dir, "plugins", "praxis", "agents", "stewart.md"), "utf-8");
    const lines = content.split("\n");

    // Find the end of the Claude Code frontmatter (second "---")
    let frontmatterEnd = 0;
    let dashCount = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        dashCount++;

        if (dashCount === 2) {
          frontmatterEnd = i;
          break;
        }
      }
    }

    // After the agent frontmatter, there should be no "type: responsibility"
    // or "type: reference" frontmatter blocks (those come from inlined files)
    const body = lines.slice(frontmatterEnd + 1).join("\n");
    expect(body).not.toMatch(/^type: responsibility$/m);
    expect(body).not.toMatch(/^type: reference$/m);
    expect(body).not.toMatch(/^owner: /m);
  });
});
