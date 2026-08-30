import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

import { addFromTemplate } from "@/commands/add.js";
import type { Logger } from "@/core/logger.js";

import { createCaptureLogger } from "../helpers/capture-logger.js";

/** Resolved path to the scaffold directory at the project root. */
const SCAFFOLD_DIR = join(import.meta.dirname, "..", "..", "scaffold");

/** Creates a fresh temporary directory with .praxis/ and content dirs. */
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

describe("addFromTemplate", () => {
  const dirs: string[] = [];
  let logOutput: () => string;
  let logger: Logger;

  afterEach(() => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    dirs.length = 0;
  });

  function makeLogger(): Logger {
    const capture = createCaptureLogger();
    logger = capture.logger;
    logOutput = capture.output;
    return logger;
  }

  it("creates a role file from template", () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    addFromTemplate("role", "code-reviewer", makeLogger(), {
      root: dir,
      scaffoldDir: SCAFFOLD_DIR,
    });

    expect(existsSync(join(dir, "content", "roles", "code-reviewer.md"))).toBe(true);
  });

  it("fills role template placeholders", () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    addFromTemplate("role", "code-reviewer", makeLogger(), {
      root: dir,
      scaffoldDir: SCAFFOLD_DIR,
    });

    const content = readFileSync(join(dir, "content", "roles", "code-reviewer.md"), "utf-8");

    expect(content).toContain('title: "Code Reviewer"');
    expect(content).toContain('alias: "code-reviewer"');
    expect(content).toContain("# Code Reviewer (a.k.a **Code Reviewer**)");
  });

  it("creates a responsibility file from template", () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    addFromTemplate("responsibility", "review-pull-requests", makeLogger(), {
      root: dir,
      scaffoldDir: SCAFFOLD_DIR,
    });

    expect(existsSync(join(dir, "content", "responsibilities", "review-pull-requests.md"))).toBe(
      true,
    );
  });

  it("fills responsibility template placeholders", () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    addFromTemplate("responsibility", "review-pull-requests", makeLogger(), {
      root: dir,
      scaffoldDir: SCAFFOLD_DIR,
    });

    const content = readFileSync(
      join(dir, "content", "responsibilities", "review-pull-requests.md"),
      "utf-8",
    );

    expect(content).toContain('title: "Review Pull Requests"');
    expect(content).toContain("# Review Pull Requests");
  });

  it("refuses to overwrite existing file", () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    const existing = join(dir, "content", "roles", "existing.md");
    writeFileSync(existing, "# My custom content\n");

    expect(() =>
      addFromTemplate("role", "existing", makeLogger(), {
        root: dir,
        scaffoldDir: SCAFFOLD_DIR,
      }),
    ).toThrow("File already exists");

    // Original content preserved
    expect(readFileSync(existing, "utf-8")).toBe("# My custom content\n");
  });

  it("handles multi-word hyphenated names", () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    addFromTemplate("responsibility", "enforce-code-style-guide", makeLogger(), {
      root: dir,
      scaffoldDir: SCAFFOLD_DIR,
    });

    const content = readFileSync(
      join(dir, "content", "responsibilities", "enforce-code-style-guide.md"),
      "utf-8",
    );

    expect(content).toContain('title: "Enforce Code Style Guide"');
    expect(content).toContain("# Enforce Code Style Guide");
  });

  it("logs success message", () => {
    const dir = makeTmpdir();
    dirs.push(dir);

    addFromTemplate("role", "test-role", makeLogger(), {
      root: dir,
      scaffoldDir: SCAFFOLD_DIR,
    });

    expect(logOutput()).toContain("Created role: content/roles/test-role.md");
  });
});
