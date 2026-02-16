import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { initProject } from "@/commands/init.js";
import { RoleCompiler } from "@/compiler/role-compiler.js";
import { Logger } from "@/core/logger.js";

/** Resolved path to the scaffold directory at the project root. */
const SCAFFOLD_DIR = join(import.meta.dirname, "..", "..", "scaffold");

/**
 * Integration test: init → compile → verify output.
 *
 * Scaffolds a fresh Praxis project via initProject, runs the
 * compiler, and verifies that agent files are produced with the
 * expected structure.
 */
describe("init → compile integration", () => {
  let dir: string;
  const logger = new Logger();

  beforeAll(async () => {
    dir = join(tmpdir(), `praxis-integration-${randomUUID()}`);

    // Scaffold the project
    initProject(dir, logger, SCAFFOLD_DIR);

    // Create .git so Paths can find the project root
    mkdirSync(join(dir, ".git"), { recursive: true });

    // Compile all roles
    const compiler = new RoleCompiler({ root: dir, logger });
    await compiler.compileAll();
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("produces stewart.md agent file", () => {
    const agentFile = join(dir, "plugins", "praxis", "agents", "stewart.md");
    expect(existsSync(agentFile)).toBe(true);
  });

  it("produces remy.md agent file", () => {
    const agentFile = join(dir, "plugins", "praxis", "agents", "remy.md");
    expect(existsSync(agentFile)).toBe(true);
  });

  it("produces exactly 2 agent files", () => {
    const agentsDir = join(dir, "plugins", "praxis", "agents");
    const files = readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
    expect(files).toHaveLength(2);
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
    // Inlined files (responsibilities, references, etc.) should have their
    // YAML frontmatter stripped. Verify no stray frontmatter blocks exist by
    // checking that typical inlined-file frontmatter keys don't appear in
    // a YAML block pattern after the initial agent frontmatter.
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
    // These patterns would indicate a frontmatter block wasn't stripped
    expect(body).not.toMatch(/^type: responsibility$/m);
    expect(body).not.toMatch(/^type: reference$/m);
    expect(body).not.toMatch(/^owner: /m);
  });
});

