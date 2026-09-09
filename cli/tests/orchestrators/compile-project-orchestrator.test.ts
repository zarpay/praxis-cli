import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { compileProjectOrchestrator } from "@/orchestrators/compile-project-orchestrator.js";
import { createCaptureLogger } from "@tests/helpers/capture-logger.js";
import { testContext } from "@tests/helpers/command-context.js";
import { createCompilerTmpdir } from "@tests/helpers/compiler-tmpdir.js";

describe("compileProjectOrchestrator", () => {
  let tmpdir: string;
  let agentProfilesDir: string;
  let cleanup: () => void;

  beforeEach(() => {
    const ctx = createCompilerTmpdir();
    tmpdir = ctx.tmpdir;
    agentProfilesDir = ctx.agentProfilesDir;
    cleanup = ctx.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  it("compiles every expert when no alias is given", async () => {
    const { logger } = createCaptureLogger();

    const outcome = await compileProjectOrchestrator(testContext(tmpdir, logger), {});

    expect(outcome).toBe("ok");
    expect(existsSync(join(agentProfilesDir, "tester.expert.md"))).toBe(true);
  });

  it("compiles exactly one expert by alias", async () => {
    const { logger } = createCaptureLogger();

    const outcome = await compileProjectOrchestrator(testContext(tmpdir, logger), {
      alias: "tester",
    });

    expect(outcome).toBe("ok");
    expect(existsSync(join(agentProfilesDir, "tester.expert.md"))).toBe(true);
  });

  it("refuses an unknown alias, listing what exists", async () => {
    const { logger } = createCaptureLogger();

    const compileUnknown = compileProjectOrchestrator(testContext(tmpdir, logger), {
      alias: "nobody",
    });

    await expect(compileUnknown).rejects.toThrow(/nobody/);
    await expect(compileUnknown).rejects.toThrow(/known aliases: Tester/);
  });

  it("ignores --watch under --alias, with the warning named", async () => {
    const { logger, output } = createCaptureLogger();

    const outcome = await compileProjectOrchestrator(testContext(tmpdir, logger), {
      alias: "tester",
      watch: true,
    });

    expect(outcome).toBe("ok");
    expect(output()).toContain("--watch is not supported with --alias");
  });
});
