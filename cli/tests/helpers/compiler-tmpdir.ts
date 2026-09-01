import { randomUUID } from "node:crypto";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Resolved path to the tests/fixtures directory. */
const FIXTURES_ROOT = join(import.meta.dirname, "..", "fixtures");

/**
 * Creates a temporary directory pre-populated with test fixtures.
 *
 * Creates a fake project root with `.praxis/` marker, `content/` subdirectories,
 * copies all test fixtures into it, and writes a `.praxis/config.json`
 * that enables the claude-code plugin for backward-compatible test behavior.
 *
 * Returns an object with path accessors and a cleanup function.
 */
export function createCompilerTmpdir(): {
  tmpdir: string;
  expertsDir: string;
  practicesDir: string;
  contextDir: string;
  agentsOutputDir: string;
  agentProfilesDir: string;
  cleanup: () => void;
} {
  const dir = join(tmpdir(), `praxis-test-${randomUUID()}`);

  const expertsDir = join(dir, "content", "experts");
  const practicesDir = join(dir, "content", "practices");
  const contextDir = join(dir, "content", "context");
  const agentsOutputDir = join(dir, "plugins", "praxis", "agents");
  const agentProfilesDir = join(dir, "agent-profiles");

  // Create structure
  mkdirSync(expertsDir, { recursive: true });
  mkdirSync(practicesDir, { recursive: true });
  mkdirSync(contextDir, { recursive: true });
  mkdirSync(join(dir, ".praxis"), { recursive: true });

  // Copy fixtures
  const contentSource = join(FIXTURES_ROOT, "content");

  if (existsSync(contentSource)) {
    cpSync(contentSource, join(dir, "content"), { recursive: true });
  }

  // Write config to .praxis/config.json
  writeFileSync(
    join(dir, ".praxis", "config.json"),
    JSON.stringify({
      sources: ["content/experts", "content/practices", "content/reference", "content/context"],
      expertsDir: "content/experts",
      practicesDir: "content/practices",
      agentProfilesOutputDir: "./agent-profiles",
      plugins: ["claude-code"],
      reviewers: [{ name: "test", model: "test-model", apiKeyEnvVar: "OPENROUTER_API_KEY" }],
    }),
  );

  return {
    tmpdir: dir,
    expertsDir,
    practicesDir,
    contextDir,
    agentsOutputDir,
    agentProfilesDir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}
