import type { FSWatcher } from "node:fs";

import type { Logger } from "@/framework/views/logger.js";

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import resolvePlugins from "@/domains/spec/services/resolve-plugins-service.js";
import watchAndCompile from "@/domains/spec/services/watch-and-compile-service.js";
import { PraxisConfig } from "@/domains/workspace/models/praxis-config.js";
import { createCaptureLogger } from "@tests/helpers/capture-logger.js";
import { createCompilerTmpdir } from "@tests/helpers/compiler-tmpdir.js";

/** Helper to wait for a given number of milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("watchAndCompile", () => {
  let tmpdir: string;
  let cleanup: () => void;
  let logOutput: () => string;
  let logger: Logger;
  let watch: (debounceMs: number) => FSWatcher[];
  let watchers: FSWatcher[] = [];

  beforeEach(() => {
    const ctx = createCompilerTmpdir();
    tmpdir = ctx.tmpdir;
    cleanup = ctx.cleanup;

    const capture = createCaptureLogger();
    logger = capture.logger;
    logOutput = capture.output;
    const config = new PraxisConfig(tmpdir);

    // The command renders these events; the test captures them the same way.
    watch = (debounceMs) =>
      watchAndCompile({
        root: tmpdir,
        sources: config.sources,
        expertsDir: config.expertsDir,
        specFilePattern: config.specFilePattern,
        agentProfilesOutputDir: config.agentProfilesOutputDir,
        plugins: resolvePlugins(config.plugins, tmpdir, logger),
        debounceMs,
        onWatch: (dir) => logger.info(`Watching ${dir} for changes...`),
        onRecompile: (filename) =>
          logger.info(`Change detected${filename ? `: ${filename}` : ""}, recompiling...`),
        onError: (message) => logger.error(message),
      });
  });

  afterEach(() => {
    for (const watcher of watchers) {
      watcher.close();
    }
    watchers = [];
    cleanup();
  });

  it("returns FSWatcher instances that can be closed", () => {
    watchers = watch(50);

    expect(watchers.length).toBeGreaterThan(0);
    for (const watcher of watchers) {
      expect(typeof watcher.close).toBe("function");
    }
  });

  it("logs watching message on start", () => {
    watchers = watch(50);

    expect(logOutput()).toContain("Watching");
    expect(logOutput()).toContain("for changes");
  });

  it("triggers recompile on file change", async () => {
    watchers = watch(50);

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
    watchers = watch(100);

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
