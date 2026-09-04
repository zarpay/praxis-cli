import type { Orchestrator } from "@/types.js";

import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import { Reviewer } from "@/models/reviewer.js";
import deriveCalibrationStatusService from "@/services/derive-calibration-status-service.js";
import calibrationStatusView from "@/views/calibration-status-view.js";

/** What `praxis calibrate status` parses. */
interface CalibrateStatusOptions {
  json: boolean;
}

/**
 * What `praxis calibrate status` does (06-g): each configured
 * reviewer's interpretability state — calibrated, stale, or absent —
 * with the reason. Pure read; never a reviewer call.
 */
export const reportCalibrationStatusOrchestrator: Orchestrator<CalibrateStatusOptions> = async (
  ctx,
  options,
) => {
  const cfg = ctx.config;
  const reviewers = cfg.reviewers.map((reviewer) => Reviewer.fromConfig(reviewer));
  const status = deriveCalibrationStatusService(cfg, { reviewers });

  const view = calibrationStatusView({ ...status, json: options.json });
  ctx.render(view);

  return "ok";
};

export default prepareOrchestrator(reportCalibrationStatusOrchestrator);
