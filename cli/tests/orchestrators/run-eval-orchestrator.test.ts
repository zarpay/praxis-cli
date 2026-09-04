import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { runEvalOrchestrator } from "@/orchestrators/run-eval-orchestrator.js";
import { createCaptureLogger } from "@tests/helpers/capture-logger.js";
import { testContext } from "@tests/helpers/command-context.js";
import { seedLedgerRun } from "@tests/helpers/ledger-runs.js";
import {
  createOpenRouterServer,
  useOpenRouterResponse,
  validationToolCallResponse,
} from "@tests/helpers/openrouter-msw.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

const server = createOpenRouterServer();
const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  process.env["OPENROUTER_API_KEY"] = "test-key";
});

afterAll(() => {
  server.close();
  delete process.env["OPENROUTER_API_KEY"];
});

const cleanups: (() => void)[] = [];

afterEach(() => {
  server.resetHandlers();
  exitSpy.mockClear();
  while (cleanups.length) cleanups.pop()?.();
});

/** A one-target project with one keyed reviewer. */
function project(): string {
  const { root, cleanup } = createValidatorTmpdir({
    sources: ["docs"],
    files: { "docs/README.md": "# Spec", "docs/guide.md": "# Guide" },
    reviewers: [{ name: "flash", model: "m", apiKeyEnvVar: "OPENROUTER_API_KEY" }],
  });
  cleanups.push(cleanup);

  return root;
}

describe("runEvalOrchestrator", () => {
  it("announces an epoch boundary and still completes the run — warn, never block (02)", async () => {
    useOpenRouterResponse(server, validationToolCallResponse("validation_pass", { reason: "ok" }));
    const root = project();
    seedLedgerRun(root, { name: "flash", hash: "00000000", model: "m" });
    const { logger, output } = createCaptureLogger();

    const outcome = await runEvalOrchestrator(testContext(root, logger), {});

    expect(outcome).toBe("ok");
    expect(output()).toContain("Epoch boundary");
    expect(output()).toContain('reviewer "flash"');
  });

  it("stays silent on bootstrap — a first run is not a boundary", async () => {
    useOpenRouterResponse(server, validationToolCallResponse("validation_pass", { reason: "ok" }));
    const { logger, output } = createCaptureLogger();

    const outcome = await runEvalOrchestrator(testContext(project(), logger), {});

    expect(outcome).toBe("ok");
    expect(output()).not.toContain("Epoch boundary");
  });

  it("fails the run on an error verdict", async () => {
    useOpenRouterResponse(
      server,
      validationToolCallResponse("validation_fail", { reason: "no", issues: ["Bad"] }),
    );

    const outcome = await runEvalOrchestrator(testContext(project()), {});

    expect(outcome).toBe("failed");
  });

  it("refuses --diff combined with named targets — two different units", async () => {
    const root = project();

    const run = runEvalOrchestrator(testContext(root), {
      targets: ["docs/guide.md"],
      diff: true,
    });

    await expect(run).rejects.toThrow(/--diff reviews what the branch changed/);
  });
});
