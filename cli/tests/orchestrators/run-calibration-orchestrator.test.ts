import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { runCalibrationOrchestrator } from "@/orchestrators/run-calibration-orchestrator.js";
import { CalibrationStore } from "@/stores/calibration-store.js";
import { calibrationRecord, expectationJson, seedCase } from "@tests/helpers/calibration-cases.js";
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

/** A project with one keyed reviewer and a live spec to freeze against. */
function project(): string {
  const { root, cleanup } = createValidatorTmpdir({
    sources: ["src"],
    files: { "src/services/README.md": "# Services\n\nStandards.\n" },
    reviewers: [{ name: "flash", model: "m", apiKeyEnvVar: "OPENROUTER_API_KEY" }],
  });
  cleanups.push(cleanup);

  return root;
}

describe("runCalibrationOrchestrator", () => {
  it("with no cases: instructs how to author them and exits ok", async () => {
    const root = project();
    const { logger, output } = createCaptureLogger();

    const outcome = await runCalibrationOrchestrator(testContext(root, logger), {});

    expect(outcome).toBe("ok");
    expect(output()).toContain("No calibration cases");
    expect(output()).toContain(".praxis/calibration/cases/");
  });

  it("calibrates each reviewer against the cases and writes records", async () => {
    useOpenRouterResponse(server, validationToolCallResponse("validation_pass", { reason: "ok" }));
    const root = project();
    seedCase(root, "case-1", {
      expectedJson: expectationJson({ verdict: "pass", expected_violations: [] }),
    });
    const { logger, output } = createCaptureLogger();

    const outcome = await runCalibrationOrchestrator(testContext(root, logger), {});

    expect(outcome).toBe("ok");
    expect(output()).toContain("Calibrating 1 reviewer(s) against 1 case(s)");
    expect(output()).toContain("Calibration — flash");

    const records = new CalibrationStore(testConfig(root)).records();
    expect(records).toHaveLength(1);
    expect(records[0].verdict_matches).toBe(1);
  });

  it("honors --repeat: opportunities multiply", async () => {
    useOpenRouterResponse(server, validationToolCallResponse("validation_pass", { reason: "ok" }));
    const root = project();
    seedCase(root, "case-1", {
      expectedJson: expectationJson({ verdict: "pass", expected_violations: [] }),
    });
    const { logger } = createCaptureLogger();

    await runCalibrationOrchestrator(testContext(root, logger), { repeat: "3" });

    const records = new CalibrationStore(testConfig(root)).records();
    expect(records[0].repeats).toBe(3);
    expect(records[0].verdict_matches).toBe(3);
  });

  it("a malformed case is warned about and skipped, never fatal", async () => {
    useOpenRouterResponse(server, validationToolCallResponse("validation_pass", { reason: "ok" }));
    const root = project();
    seedCase(root, "case-good", {
      expectedJson: expectationJson({ verdict: "pass", expected_violations: [] }),
    });
    seedCase(root, "case-bad", { expectedJson: "{ not json" });
    const { logger, output } = createCaptureLogger();

    const outcome = await runCalibrationOrchestrator(testContext(root, logger), {});

    expect(outcome).toBe("ok");
    expect(output()).toContain("Skipping malformed case");

    const records = new CalibrationStore(testConfig(root)).records();
    expect(records[0].case_count).toBe(1);
  });

  it("record fixture and store round-trip stay aligned", () => {
    const root = project();
    const store = new CalibrationStore(testConfig(root));
    const record = calibrationRecord();

    store.writeRecord(record);

    expect(store.latestByName(record.reviewer_name)).toEqual(record);
  });
});
