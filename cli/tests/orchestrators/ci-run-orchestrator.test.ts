import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ciRunOrchestrator } from "@/orchestrators/ci-run-orchestrator.js";
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

describe("ciRunOrchestrator", () => {
  it("verifies without writing — no ledger records, ever (12)", async () => {
    useOpenRouterResponse(server, validationToolCallResponse("validation_pass", { reason: "ok" }));
    const root = project();

    const outcome = await ciRunOrchestrator(testContext(root), {});

    expect(outcome).toBe("ok");
    expect(existsSync(join(root, ".praxis", "ledger"))).toBe(false);
  });

  it("fails on errors regardless of --strict", async () => {
    useOpenRouterResponse(
      server,
      validationToolCallResponse("validation_fail", { reason: "no", issues: ["Bad"] }),
    );

    expect(await ciRunOrchestrator(testContext(project()), {})).toBe("failed");
  });

  it("announces an epoch boundary without blocking or writing (02, 12)", async () => {
    useOpenRouterResponse(server, validationToolCallResponse("validation_pass", { reason: "ok" }));
    const root = project();
    seedLedgerRun(root, { name: "flash", hash: "00000000", model: "m" });
    const { logger, output } = createCaptureLogger();

    const outcome = await ciRunOrchestrator(testContext(root, logger), {});
    const runFiles = readdirSync(join(root, ".praxis", "ledger", "runs"));

    expect(outcome).toBe("ok");
    expect(output()).toContain("Epoch boundary");
    // Only the seeded file: CI read the ledger but wrote nothing.
    expect(runFiles).toHaveLength(1);
  });

  it("counts warnings as failure only under --strict", async () => {
    useOpenRouterResponse(
      server,
      validationToolCallResponse("validation_warn", { reason: "meh", issues: ["Thin"] }),
    );

    expect(await ciRunOrchestrator(testContext(project()), {})).toBe("ok");
    expect(await ciRunOrchestrator(testContext(project()), { strict: true })).toBe("failed");
  });

  it("leaves the cache untouched — a miss verifies but never writes back (12)", async () => {
    useOpenRouterResponse(server, validationToolCallResponse("validation_pass", { reason: "ok" }));
    const root = project();

    await ciRunOrchestrator(testContext(root), {});

    expect(existsSync(join(root, ".praxis", "cache"))).toBe(false);
  });
});
