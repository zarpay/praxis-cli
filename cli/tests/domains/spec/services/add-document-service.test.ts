import type { AddDocumentResult } from "@/domains/spec/types.js";

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import addDocumentService from "@/domains/spec/services/add-document-service.js";
import { PraxisConfig } from "@/domains/workspace/models/praxis-config.js";

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

describe("addDocumentOrchestrator", () => {
  let root: string;
  let add: (type: "expert" | "practice", name: string) => AddDocumentResult;

  beforeEach(() => {
    root = makeTmpdir();
    const config = new PraxisConfig(root);

    add = (type, name) =>
      addDocumentService({
        type,
        name,
        root,
        expertsDir: config.expertsDir,
        practicesDir: config.practicesDir,
      });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("creates an expert file from template", () => {
    add("expert", "code-reviewer");

    expect(existsSync(join(root, "content", "experts", "code-reviewer.md"))).toBe(true);
  });

  it("fills expert template placeholders", () => {
    add("expert", "code-reviewer");

    const content = readFileSync(join(root, "content", "experts", "code-reviewer.md"), "utf-8");

    expect(content).toContain('title: "Code Reviewer"');
    expect(content).toContain('alias: "code-reviewer"');
    expect(content).toContain("# Code Reviewer (a.k.a **Code Reviewer**)");
  });

  it("creates a practice file from template", () => {
    add("practice", "review-pull-requests");

    expect(existsSync(join(root, "content", "practices", "review-pull-requests.md"))).toBe(true);
  });

  it("fills practice template placeholders", () => {
    add("practice", "review-pull-requests");

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

    expect(() => add("expert", "existing")).toThrow("File already exists");

    // Original content preserved
    expect(readFileSync(existing, "utf-8")).toBe("# My custom content\n");
  });

  it("handles multi-word hyphenated names", () => {
    add("practice", "enforce-code-style-guide");

    const content = readFileSync(
      join(root, "content", "practices", "enforce-code-style-guide.md"),
      "utf-8",
    );

    expect(content).toContain('title: "Enforce Code Style Guide"');
    expect(content).toContain("# Enforce Code Style Guide");
  });

  it("reports what it created and where", () => {
    const created = add("expert", "test-expert");

    expect(created).toEqual({ type: "expert", path: "content/experts/test-expert.md" });
  });
});
