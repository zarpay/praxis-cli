import { type FSWatcher, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { watchAndRecompile } from "@/commands/compile.js";
import { RoleCompiler } from "@/compiler/role-compiler.js";
import { PraxisConfig } from "@/core/config.js";
import type { Logger } from "@/core/logger.js";

import { createCompilerTmpdir } from "../helpers/compiler-tmpdir.js";
import { createCaptureLogger } from "../helpers/capture-logger.js";

/** Helper to wait for a given number of milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("watchAndRecompile", () => {
  let tmpdir: string;
  let cleanup: () => void;
  let logOutput: () => string;
  let logger: Logger;
  let compiler: RoleCompiler;
  let config: PraxisConfig;
  let watchers: FSWatcher[] = [];

  beforeEach(() => {
    const ctx = createCompilerTmpdir();
    tmpdir = ctx.tmpdir;
    cleanup = ctx.cleanup;

    const capture = createCaptureLogger();
    logger = capture.logger;
    logOutput = capture.output;
    config = new PraxisConfig(tmpdir);
    compiler = new RoleCompiler({ root: tmpdir, logger, config });
  });

  afterEach(() => {
    for (const watcher of watchers) {
      watcher.close();
    }
    watchers = [];
    cleanup();
  });

  it("returns FSWatcher instances that can be closed", () => {
    watchers = watchAndRecompile(tmpdir, config, compiler, logger, { debounceMs: 50 });

    expect(watchers.length).toBeGreaterThan(0);
    for (const watcher of watchers) {
      expect(typeof watcher.close).toBe("function");
    }
  });

  it("logs watching message on start", () => {
    watchers = watchAndRecompile(tmpdir, config, compiler, logger, { debounceMs: 50 });

    expect(logOutput()).toContain("Watching");
    expect(logOutput()).toContain("for changes");
  });

  it("triggers recompile on file change", async () => {
    watchers = watchAndRecompile(tmpdir, config, compiler, logger, { debounceMs: 50 });

    // Modify a file in a source directory
    writeFileSync(
      join(tmpdir, "content", "roles", "test-role.md"),
      "---\nalias: Tester\ndescription: updated\n---\n# Updated",
    );

    // Wait for debounce + processing
    await sleep(300);

    expect(logOutput()).toContain("Change detected");
    expect(logOutput()).toContain("recompiling");
  });

  it("debounces rapid changes", async () => {
    watchers = watchAndRecompile(tmpdir, config, compiler, logger, { debounceMs: 100 });

    // Trigger 5 rapid writes
    for (let i = 0; i < 5; i++) {
      writeFileSync(
        join(tmpdir, "content", "roles", "test-role.md"),
        `---\nalias: Tester\ndescription: change ${i}\n---\n# Change ${i}`,
      );
    }

    // Wait for debounce + processing
    await sleep(400);

    // Should see "Change detected" only once (debounced)
    const changeCount = (logOutput().match(/Change detected/g) ?? []).length;
    expect(changeCount).toBe(1);
  });
});
