import type { LedgerCritiqueRecord, LedgerRunRecord } from "@/types.js";

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { giveFeedbackOrchestrator } from "@/orchestrators/give-feedback-orchestrator.js";
import deriveTriageStateService from "@/services/derive-triage-state-service.js";
import { createCaptureLogger } from "@tests/helpers/capture-logger.js";
import { testContext } from "@tests/helpers/command-context.js";
import {
  createOpenRouterServer,
  useOpenRouterResponse,
  validationToolCallResponse,
} from "@tests/helpers/openrouter-msw.js";
import { testConfig } from "@tests/helpers/test-config.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

const server = createOpenRouterServer();

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
  while (cleanups.length) cleanups.pop()?.();
});

/** A project with one governed file and one the spec excludes. */
function project(): string {
  const { root, cleanup } = createValidatorTmpdir({
    sources: ["docs"],
    files: {
      "docs/README.md": `---\npaths:\n  - "docs/*.md"\nexcludes:\n  - "docs/legacy.md"\n---\n\n# Spec\n`,
      "docs/guide.md": "# Guide\n",
      "docs/legacy.md": "# Legacy\n",
      "elsewhere/stray.md": "# Stray\n",
    },
    reviewers: [{ name: "flash", model: "m", apiKeyEnvVar: "OPENROUTER_API_KEY" }],
  });

  cleanups.push(cleanup);

  return root;
}

/** Every ledger record the run wrote. */
function ledger(root: string): { runs: LedgerRunRecord[]; critiques: LedgerCritiqueRecord[] } {
  const dir = join(root, ".praxis", "ledger", "runs");

  if (!existsSync(dir)) return { runs: [], critiques: [] };

  const records = readdirSync(dir).flatMap((file) =>
    readFileSync(join(dir, file), "utf8")
      .trimEnd()
      .split("\n")
      .map((line) => JSON.parse(line) as LedgerRunRecord | LedgerCritiqueRecord),
  );

  return {
    runs: records.filter((record): record is LedgerRunRecord => record.kind === "run"),
    critiques: records.filter(
      (record): record is LedgerCritiqueRecord => record.kind === "critique",
    ),
  };
}

/** Whether any verdict cache file exists. */
function cacheWritten(root: string): boolean {
  return existsSync(join(root, ".praxis", "cache", "validation"));
}

/** A failing verdict, so there is a critique to account for. */
function failingResponse(): object {
  return validationToolCallResponse("validation_fail", {
    reason: "The guide never says what it is for.",
    issues: ["The guide never says what it is for."],
  });
}

describe("giveFeedbackOrchestrator", () => {
  it("records the run as advisory, with its critiques and its cost", async () => {
    useOpenRouterResponse(server, failingResponse());
    const root = project();
    const { logger } = createCaptureLogger();

    const outcome = await giveFeedbackOrchestrator(testContext(root, logger), {
      target: "docs/guide.md",
    });

    const { runs, critiques } = ledger(root);

    expect(outcome).toBe("ok");
    expect(runs).toHaveLength(1);
    expect(runs[0]?.scope).toBe("advisory");
    expect(critiques).toHaveLength(1);
    expect(critiques[0]?.text).toContain("never says what it is for");
  });

  it("never writes the verdict cache", async () => {
    useOpenRouterResponse(server, failingResponse());
    const root = project();
    const { logger } = createCaptureLogger();

    await giveFeedbackOrchestrator(testContext(root, logger), { target: "docs/guide.md" });

    // A cache hit writes no critique record, so a cached advisory verdict
    // would silently suppress the evidence the next measurement run was
    // supposed to produce. This is the assertion the feature rests on.
    expect(cacheWritten(root)).toBe(false);
  });

  it("keeps its critiques out of the triage queue", async () => {
    useOpenRouterResponse(server, failingResponse());
    const root = project();
    const { logger } = createCaptureLogger();

    await giveFeedbackOrchestrator(testContext(root, logger), { target: "docs/guide.md" });

    const state = deriveTriageStateService(testConfig(root), {});

    expect(ledger(root).critiques).toHaveLength(1);
    expect(state.pending).toEqual([]);
    expect(state.unidentified).toEqual([]);
  });

  it("refuses a target no spec governs, naming why", async () => {
    const root = project();
    const { logger } = createCaptureLogger();

    const attempt = giveFeedbackOrchestrator(testContext(root, logger), {
      target: "elsewhere/stray.md",
    });

    await expect(attempt).rejects.toThrow(/No expert covers/);
    expect(ledger(root).runs).toEqual([]);
  });

  it("refuses a target the spec excludes", async () => {
    const root = project();
    const { logger } = createCaptureLogger();

    const attempt = giveFeedbackOrchestrator(testContext(root, logger), {
      target: "docs/legacy.md",
    });

    await expect(attempt).rejects.toThrow(/No expert covers/);
  });

  it("runs only the named reviewer", async () => {
    useOpenRouterResponse(server, validationToolCallResponse("validation_pass", { reason: "ok" }));
    const { root, cleanup } = createValidatorTmpdir({
      sources: ["docs"],
      files: { "docs/README.md": "# Spec\n", "docs/guide.md": "# Guide\n" },
      reviewers: [
        { name: "flash", model: "m", apiKeyEnvVar: "OPENROUTER_API_KEY" },
        { name: "v32", model: "m2", apiKeyEnvVar: "OPENROUTER_API_KEY" },
      ],
    });
    cleanups.push(cleanup);
    const { logger } = createCaptureLogger();

    await giveFeedbackOrchestrator(testContext(root, logger), {
      target: "docs/guide.md",
      reviewer: "flash",
    });

    const { runs } = ledger(root);

    expect(runs).toHaveLength(1);
    expect(runs[0]?.reviewer_name).toBe("flash");
  });
});
