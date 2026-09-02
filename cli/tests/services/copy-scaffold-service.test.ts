import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import copyScaffoldService from "@/services/copy-scaffold-service.js";

describe("copyScaffoldService", () => {
  let sourceDir: string;
  let targetDir: string;

  beforeEach(() => {
    const base = join(tmpdir(), `praxis-scaffold-test-${randomUUID()}`);
    sourceDir = join(base, "scaffold");
    targetDir = join(base, "project");
    mkdirSync(join(sourceDir, "nested"), { recursive: true });
    mkdirSync(join(sourceDir, ".praxis"), { recursive: true });
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(sourceDir, "README.md"), "# Top");
    writeFileSync(join(sourceDir, "nested", "deep.md"), "# Deep");
    writeFileSync(join(sourceDir, ".praxis", "config.json"), "{}");
  });

  afterEach(() => {
    rmSync(join(sourceDir, ".."), { recursive: true, force: true });
  });

  it("copies the whole tree, dotfiles included, reporting what it added", () => {
    const result = copyScaffoldService({ sourceDir, targetDir });

    expect(result.created.sort()).toEqual([".praxis/config.json", "README.md", "nested/deep.md"]);
    expect(result.skipped).toBe(0);
    expect(readFileSync(join(targetDir, "nested", "deep.md"), "utf8")).toBe("# Deep");
  });

  it("never overwrites — an existing file is skipped and kept", () => {
    writeFileSync(join(targetDir, "README.md"), "# Mine");

    const result = copyScaffoldService({ sourceDir, targetDir });

    expect(result.skipped).toBe(1);
    expect(result.created).not.toContain("README.md");
    expect(readFileSync(join(targetDir, "README.md"), "utf8")).toBe("# Mine");
  });

  it("is idempotent: a second run creates nothing", () => {
    copyScaffoldService({ sourceDir, targetDir });

    const again = copyScaffoldService({ sourceDir, targetDir });

    expect(again.created).toEqual([]);
    expect(again.skipped).toBe(3);
  });
});
