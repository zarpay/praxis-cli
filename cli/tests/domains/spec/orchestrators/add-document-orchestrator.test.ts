import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { addDocumentOrchestrator } from "@/domains/spec/orchestrators/add-document-orchestrator.js";
import { createCaptureLogger } from "@tests/helpers/capture-logger.js";
import { testContext } from "@tests/helpers/command-context.js";

/** Resolved path to the scaffold directory at the project root. */
const SCAFFOLD_DIR = join(import.meta.dirname, "..", "..", "..", "..", "scaffold");

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
  let add: (type: "expert" | "practice", name: string) => Promise<unknown>;
  let logged: () => string;

  beforeEach(() => {
    root = makeTmpdir();
    const capture = createCaptureLogger();
    logged = capture.output;
    const ctx = testContext(root, capture.logger);

    add = (type, name) => addDocumentOrchestrator(ctx, { type, name, scaffoldDir: SCAFFOLD_DIR });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("creates an expert file from template", async () => {
    await add("expert", "code-reviewer");

    expect(existsSync(join(root, "content", "experts", "code-reviewer.md"))).toBe(true);
  });

  it("fills expert template placeholders", async () => {
    await add("expert", "code-reviewer");

    const content = readFileSync(join(root, "content", "experts", "code-reviewer.md"), "utf-8");

    expect(content).toContain('title: "Code Reviewer"');
    expect(content).toContain('alias: "code-reviewer"');
    expect(content).toContain("# Code Reviewer (a.k.a **Code Reviewer**)");
  });

  it("creates a practice file from template", async () => {
    await add("practice", "review-pull-requests");

    expect(existsSync(join(root, "content", "practices", "review-pull-requests.md"))).toBe(true);
  });

  it("fills practice template placeholders", async () => {
    await add("practice", "review-pull-requests");

    const content = readFileSync(
      join(root, "content", "practices", "review-pull-requests.md"),
      "utf-8",
    );

    expect(content).toContain('title: "Review Pull Requests"');
    expect(content).toContain("# Review Pull Requests");
  });

  it("refuses to overwrite existing file", async () => {
    const existing = join(root, "content", "experts", "existing.md");
    writeFileSync(existing, "# My custom content\n");

    await expect(add("expert", "existing")).rejects.toThrow("File already exists");

    // Original content preserved
    expect(readFileSync(existing, "utf-8")).toBe("# My custom content\n");
  });

  it("throws when the scaffold template is missing", async () => {
    const emptyScaffold = join(root, "empty-scaffold");
    mkdirSync(emptyScaffold, { recursive: true });
    const broken = addDocumentOrchestrator(testContext(root), {
      type: "expert",
      name: "anything",
      scaffoldDir: emptyScaffold,
    });

    await expect(broken).rejects.toThrow("Template not found");
  });

  it("handles multi-word hyphenated names", async () => {
    await add("practice", "enforce-code-style-guide");

    const content = readFileSync(
      join(root, "content", "practices", "enforce-code-style-guide.md"),
      "utf-8",
    );

    expect(content).toContain('title: "Enforce Code Style Guide"');
    expect(content).toContain("# Enforce Code Style Guide");
  });

  it("reports what it created and where", async () => {
    await add("expert", "test-expert");

    expect(logged()).toContain("Created expert: content/experts/test-expert.md");
  });
});
