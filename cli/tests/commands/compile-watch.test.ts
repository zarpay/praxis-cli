import type { Logger } from "@/core/logger.js";

import { type FSWatcher, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CompileCommand } from "@/commands/compile.js";
import { PraxisConfig } from "@/core/config.js";
import { createCaptureLogger } from "@tests/helpers/capture-logger.js";
import { createCompilerTmpdir } from "@tests/helpers/compiler-tmpdir.js";

/** Helper to wait for a given number of milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("CompileCommand.watch()", () => {
  let tmpdir: string;
  let cleanup: () => void;
  let logOutput: () => string;
  let logger: Logger;
  let command: CompileCommand;
  let watchers: FSWatcher[] = [];

  beforeEach(() => {
    const ctx = createCompilerTmpdir();
    tmpdir = ctx.tmpdir;
    cleanup = ctx.cleanup;

    const capture = createCaptureLogger();
    logger = capture.logger;
    logOutput = capture.output;
    command = new CompileCommand({ root: tmpdir, config: new PraxisConfig(tmpdir), logger });
  });

  afterEach(() => {
    for (const watcher of watchers) {
      watcher.close();
    }
    watchers = [];
    cleanup();
  });

  it("returns FSWatcher instances that can be closed", () => {
    watchers = command.watch({ debounceMs: 50 });

    expect(watchers.length).toBeGreaterThan(0);
    for (const watcher of watchers) {
      expect(typeof watcher.close).toBe("function");
    }
  });

  it("logs watching message on start", () => {
    watchers = command.watch({ debounceMs: 50 });

    expect(logOutput()).toContain("Watching");
    expect(logOutput()).toContain("for changes");
  });

  it("triggers recompile on file change", async () => {
    watchers = command.watch({ debounceMs: 50 });

    // Modify a file in a source directory
    writeFileSync(
      join(tmpdir, "content", "experts", "test-expert.md"),
      "---\nalias: Tester\ndescription: updated\n---\n# Updated",
    );

    // Wait for debounce + processing
    await sleep(300);

    expect(logOutput()).toContain("Change detected");
    expect(logOutput()).toContain("recompiling");
  });

  it("debounces rapid changes", async () => {
    watchers = command.watch({ debounceMs: 100 });

    // Trigger 5 rapid writes
    for (let i = 0; i < 5; i++) {
      writeFileSync(
        join(tmpdir, "content", "experts", "test-expert.md"),
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
