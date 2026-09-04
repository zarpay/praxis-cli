import type { Orchestrator } from "@/types.js";

import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import { Reviewer } from "@/models/reviewer.js";
import runCalibrationService from "@/services/run-calibration-service.js";
import selectReviewersService from "@/services/select-reviewers-service.js";
import { CalibrationCaseStore } from "@/stores/calibration-case-store.js";
import calibrationProgressView from "@/views/calibration-progress-view.js";
import calibrationRunView from "@/views/calibration-run-view.js";

/** What `praxis calibrate run` parses. */
interface CalibrateRunOptions {
  /** Narrow to one reviewer; omitted calibrates all of them. */
  reviewer?: string;
  /** Full-set passes; > 1 measures variance. Commander hands a string. */
  repeat?: string;
}

/**
 * What `praxis calibrate run` does (06): measure every selected
 * reviewer against the frozen case set, write one calibration record
 * per reviewer to the ledger, and report agreement, per-axiom scores,
 * and drift.
 */
export const runCalibrationOrchestrator: Orchestrator<CalibrateRunOptions> = async (
  ctx,
  options,
) => {
  const cfg = ctx.config;
  const selected = selectReviewersService(cfg, { only: options.reviewer });
  const repeats = Math.max(1, Number(options.repeat ?? 1) || 1);

  const caseStore = new CalibrationCaseStore(cfg);
  const { cases, problems } = caseStore.all();

  for (const problem of problems) {
    ctx.logger.warn(`Skipping malformed case: ${problem.message}`);
  }

  if (cases.length === 0) {
    ctx.logger.warn(
      "No calibration cases at .praxis/calibration/cases/ — author some first: " +
        "freeze an input file and the governing spec (spec.md) beside an expected.json (06). " +
        "Seed sources: spec exemplars, adjudicated disputes, constructed minimal violations.",
    );

    return "ok";
  }

  ctx.logger.info(
    `Calibrating ${selected.length} reviewer(s) against ${cases.length} case(s)` +
      (repeats > 1 ? ` × ${repeats} repeats` : ""),
  );

  for (const reviewerConfig of selected) {
    const reviewer = Reviewer.fromConfig(reviewerConfig);
    const result = await runCalibrationService(cfg, {
      reviewer,
      cases,
      repeats,
      onProgress: (event) => {
        const progressView = calibrationProgressView(event.outcome);
        ctx.render(progressView);
      },
    });

    const view = calibrationRunView(result.record);
    ctx.render(view);
  }

  return "ok";
};

export default prepareOrchestrator(runCalibrationOrchestrator);
