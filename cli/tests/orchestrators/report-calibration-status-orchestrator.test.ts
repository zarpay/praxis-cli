import { afterEach, describe, expect, it } from "vitest";

import { reportCalibrationStatusOrchestrator } from "@/orchestrators/report-calibration-status-orchestrator.js";
import { createCaptureLogger } from "@tests/helpers/capture-logger.js";
import { testContext } from "@tests/helpers/command-context.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

function project(): string {
  const { root, cleanup } = createValidatorTmpdir({
    sources: ["src"],
    files: {},
    reviewers: [{ name: "flash", model: "m", apiKeyEnvVar: "OPENROUTER_API_KEY" }],
  });
  cleanups.push(cleanup);

  return root;
}

describe("reportCalibrationStatusOrchestrator", () => {
  it("renders each reviewer's state and exits ok", async () => {
    const root = project();
    const { logger, output } = createCaptureLogger();

    const outcome = await reportCalibrationStatusOrchestrator(testContext(root, logger), {
      json: false,
    });

    expect(outcome).toBe("ok");
    expect(output()).toContain("Calibration status");
  });

  it("json mode exits ok without the human heading", async () => {
    const root = project();
    const { logger, output } = createCaptureLogger();

    const outcome = await reportCalibrationStatusOrchestrator(testContext(root, logger), {
      json: true,
    });

    expect(outcome).toBe("ok");
    expect(output()).not.toContain("Calibration status");
  });
});
