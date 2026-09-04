import type { ReviewerCalibrationStatus } from "@/types.js";

import { describe, expect, it } from "vitest";

import calibrationStatusView from "@/views/calibration-status-view.js";
import { reportText } from "@tests/helpers/report-text.js";

const CALIBRATED: ReviewerCalibrationStatus = {
  reviewer: "v32",
  state: "calibrated",
  detail: "calibrated 2026-09-05",
  lastCalibratedAt: "2026-09-05T00:00:00.000Z",
};

const STALE: ReviewerCalibrationStatus = {
  reviewer: "flash",
  state: "stale",
  detail: "reviewer identity changed since 2026-09-01 — recalibrate",
  lastCalibratedAt: "2026-09-01T00:00:00.000Z",
};

describe("calibrationStatusView", () => {
  it("renders one badge line per reviewer", () => {
    const text = reportText(calibrationStatusView({ statuses: [CALIBRATED, STALE], anyStale: true }));

    expect(text).toContain("Calibration status");
    expect(text).toContain("v32 — calibrated 2026-09-05");
    expect(text).toContain("flash — reviewer identity changed since 2026-09-01 — recalibrate");
  });

  it("json mode renders the stable contract instead", () => {
    const lines = calibrationStatusView({ statuses: [STALE], anyStale: true, json: true });
    const payload = JSON.parse(reportText(lines)) as { statuses: unknown[]; any_stale: boolean };

    expect(payload.any_stale).toBe(true);
    expect(payload.statuses).toHaveLength(1);
  });
});
