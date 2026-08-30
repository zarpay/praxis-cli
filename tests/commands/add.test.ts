import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AddCommand } from "@/commands/add.js";

import { createCaptureLogger } from "../helpers/capture-logger.js";

/** Resolved path to the scaffold directory at the project root. */
const SCAFFOLD_DIR = join(import.meta.dirname, "..", "..", "scaffold");

/** Creates a fresh temporary project root with .praxis/ and content dirs. */
function makeTmpdir(): string {
  const dir = join(tmpdir(), `praxis-add-test-${randomUUID()}`);
  mkdirSync(join(dir, ".praxis"), { recursive: true });
  mkdirSync(join(dir, "content", "roles"), { recursive: true });
  mkdirSync(join(dir, "content", "responsibilities"), { recursive: true });
  // Write config pointing to content/ subdirs
  writeFileSync(
    join(dir, ".praxis", "config.json"),
    JSON.stringify({
      rolesDir: "content/roles",
      responsibilitiesDir: "content/responsibilities",
    }),
  );
  return dir;
}

describe("AddCommand", () => {
  let root: string;
  let command: AddCommand;
  let logOutput: () => string;

  beforeEach(() => {
    root = makeTmpdir();
    const capture = createCaptureLogger();
    logOutput = capture.output;
    command = new AddCommand({ root, scaffoldDir: SCAFFOLD_DIR, logger: capture.logger });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("creates a role file from template", () => {
    command.add("role", "code-reviewer");

    expect(existsSync(join(root, "content", "roles", "code-reviewer.md"))).toBe(true);
  });

  it("fills role template placeholders", () => {
    command.add("role", "code-reviewer");

    const content = readFileSync(join(root, "content", "roles", "code-reviewer.md"), "utf-8");

    expect(content).toContain('title: "Code Reviewer"');
    expect(content).toContain('alias: "code-reviewer"');
    expect(content).toContain("# Code Reviewer (a.k.a **Code Reviewer**)");
  });

  it("creates a responsibility file from template", () => {
    command.add("responsibility", "review-pull-requests");

    expect(existsSync(join(root, "content", "responsibilities", "review-pull-requests.md"))).toBe(
      true,
    );
  });

  it("fills responsibility template placeholders", () => {
    command.add("responsibility", "review-pull-requests");

    const content = readFileSync(
      join(root, "content", "responsibilities", "review-pull-requests.md"),
      "utf-8",
    );

    expect(content).toContain('title: "Review Pull Requests"');
    expect(content).toContain("# Review Pull Requests");
  });

  it("refuses to overwrite existing file", () => {
    const existing = join(root, "content", "roles", "existing.md");
    writeFileSync(existing, "# My custom content\n");

    expect(() => command.add("role", "existing")).toThrow("File already exists");

    // Original content preserved
    expect(readFileSync(existing, "utf-8")).toBe("# My custom content\n");
  });

  it("throws when the scaffold template is missing", () => {
    const emptyScaffold = join(root, "empty-scaffold");
    mkdirSync(emptyScaffold, { recursive: true });
    const broken = new AddCommand({ root, scaffoldDir: emptyScaffold });

    expect(() => broken.add("role", "anything")).toThrow("Template not found");
  });

  it("handles multi-word hyphenated names", () => {
    command.add("responsibility", "enforce-code-style-guide");

    const content = readFileSync(
      join(root, "content", "responsibilities", "enforce-code-style-guide.md"),
      "utf-8",
    );

    expect(content).toContain('title: "Enforce Code Style Guide"');
    expect(content).toContain("# Enforce Code Style Guide");
  });

  it("logs success message", () => {
    command.add("role", "test-role");

    expect(logOutput()).toContain("Created role: content/roles/test-role.md");
  });
});
