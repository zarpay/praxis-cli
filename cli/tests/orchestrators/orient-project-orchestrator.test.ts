import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { orientProjectOrchestrator } from "@/orchestrators/orient-project-orchestrator.js";
import { createCaptureLogger } from "@tests/helpers/capture-logger.js";
import { testContext } from "@tests/helpers/command-context.js";

describe("orientProjectOrchestrator", () => {
  let root: string;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-orient-test-${randomUUID()}`);
    mkdirSync(root, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("orients inside a project — the screen names its commands", async () => {
    mkdirSync(join(root, ".praxis"), { recursive: true });
    writeFileSync(join(root, ".praxis", "config.json"), JSON.stringify({ sources: ["src"] }));
    const { logger, output } = createCaptureLogger();

    const outcome = await orientProjectOrchestrator(testContext(root, logger), {});

    expect(outcome).toBe("ok");
    expect(output()).toContain("Praxis");
  });

  it("degrades gracefully outside a project — points at init instead of throwing", async () => {
    const { logger } = createCaptureLogger();

    // The fallback line renders on stdout (Display is the one stdout
    // seam and is not captured here); the contract this pins is the
    // branch: no PraxisError escapes, and the outcome stays ok.
    const outcome = await orientProjectOrchestrator(testContext(root, logger), {});

    expect(outcome).toBe("ok");
  });
});
