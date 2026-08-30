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
  mkdirSync(join(dir, "content", "experts"), { recursive: true });
  mkdirSync(join(dir, "content", "practices"), { recursive: true });
  // Write config pointing to content/ subdirs
  writeFileSync(
    join(dir, ".praxis", "config.json"),
    JSON.stringify({
      expertsDir: "content/experts",
      practicesDir: "content/practices",
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

  it("creates an expert file from template", () => {
    command.add("expert", "code-reviewer");

    expect(existsSync(join(root, "content", "experts", "code-reviewer.md"))).toBe(true);
  });

  it("fills expert template placeholders", () => {
    command.add("expert", "code-reviewer");

    const content = readFileSync(join(root, "content", "experts", "code-reviewer.md"), "utf-8");

    expect(content).toContain('title: "Code Reviewer"');
    expect(content).toContain('alias: "code-reviewer"');
    expect(content).toContain("# Code Reviewer (a.k.a **Code Reviewer**)");
  });

  it("creates a practice file from template", () => {
    command.add("practice", "review-pull-requests");

    expect(existsSync(join(root, "content", "practices", "review-pull-requests.md"))).toBe(true);
  });

  it("fills practice template placeholders", () => {
    command.add("practice", "review-pull-requests");

    const content = readFileSync(
      join(root, "content", "practices", "review-pull-requests.md"),
      "utf-8",
    );

    expect(content).toContain('title: "Review Pull Requests"');
    expect(content).toContain("# Review Pull Requests");
  });

  it("refuses to overwrite existing file", () => {
    const existing = join(root, "content", "experts", "existing.md");
    writeFileSync(existing, "# My custom content\n");

    expect(() => command.add("expert", "existing")).toThrow("File already exists");

    // Original content preserved
    expect(readFileSync(existing, "utf-8")).toBe("# My custom content\n");
  });

  it("throws when the scaffold template is missing", () => {
    const emptyScaffold = join(root, "empty-scaffold");
    mkdirSync(emptyScaffold, { recursive: true });
    const broken = new AddCommand({ root, scaffoldDir: emptyScaffold });

    expect(() => broken.add("expert", "anything")).toThrow("Template not found");
  });

  it("handles multi-word hyphenated names", () => {
    command.add("practice", "enforce-code-style-guide");

    const content = readFileSync(
      join(root, "content", "practices", "enforce-code-style-guide.md"),
      "utf-8",
    );

    expect(content).toContain('title: "Enforce Code Style Guide"');
    expect(content).toContain("# Enforce Code Style Guide");
  });

  it("logs success message", () => {
    command.add("expert", "test-expert");

    expect(logOutput()).toContain("Created expert: content/experts/test-expert.md");
  });
});
