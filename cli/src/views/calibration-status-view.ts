import type { ReviewerCalibrationStatus } from "@/types.js";
import type { View } from "@framework/types.js";

/** What the status orchestrator hands over, plus the output mode. */
interface CalibrationStatusData {
  statuses: ReviewerCalibrationStatus[];
  anyStale: boolean;
  json?: boolean;
}

/**
 * Each reviewer's interpretability state, one line each (06-g). With
 * `json`, the same state as the stable machine contract instead.
 */
const calibrationStatusView: View<CalibrationStatusData> = ({ statuses, anyStale, json }) => {
  if (json) {
    const payload = { statuses, any_stale: anyStale };

    return [{ channel: "content", entries: [JSON.stringify(payload, null, 2)] }];
  }

  const lines = statuses.map((status) => ({
    badge: status.state.toUpperCase(),
    color: colorOf(status.state),
    value: `${status.reviewer} — ${status.detail}`,
  }));

  return [
    { channel: "heading", text: "Calibration status" },
    { channel: "content", entries: lines },
  ];
};

export default calibrationStatusView;

/** Fixed semantics: calibrated green, stale yellow, absent red (09). */
function colorOf(state: ReviewerCalibrationStatus["state"]): "green" | "red" | "yellow" {
  if (state === "calibrated") return "green";

  return state === "stale" ? "yellow" : "red";
}
