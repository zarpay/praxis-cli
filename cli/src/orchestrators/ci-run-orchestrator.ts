import type { CiRunOptions, EvalProgress } from "@/types.js";
import type { Orchestrator } from "@/types.js";

import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import detectEpochBoundariesService from "@/services/detect-epoch-boundaries-service.js";
import reviewProjectService from "@/services/review-project-service.js";
import epochBoundaryView from "@/views/epoch-boundary-view.js";
import evalHeadlineView from "@/views/eval-headline-view.js";
import runProgressView from "@/views/run-progress-view.js";
import runReportView from "@/views/run-report-view.js";

/**
 * What `praxis eval ci` does: one full review, framed for CI.
 *
 * Always a full run — CI has no targets to name — and always cached, so
 * a pipeline pays only for what changed. `--strict` is the only thing it
 * takes: whether warnings count as failure alongside errors.
 */
export const ciRunOrchestrator: Orchestrator<CiRunOptions> = async (ctx, { strict = false }) => {
  const cfg = ctx.config;

  const evalView = evalHeadlineView({ ci: true });
  ctx.render(evalView);

  // Announce any epoch boundary before reviewing (02): warn, never block.
  const boundaries = detectEpochBoundariesService(cfg, { reviewers: cfg.reviewers });
  const boundaryView = epochBoundaryView(boundaries);

  ctx.render(boundaryView);

  // The progress event is emitted when a target is reviewed, and the
  // verdict is available. It is emitted for every target, so the view
  // can be updated in real time.
  const onProgress = (event: EvalProgress) => {
    const progressView = runProgressView(event);
    ctx.render(progressView);
  };

  const run = await reviewProjectService(cfg, {
    // CI verifies without writing (12): the branch's own runs are the evidence.
    ledger: false,
    onProgress,
  });

  const reportView = runReportView({ run, cached: true });
  ctx.render(reportView);

  const { errors, warnings, unverified } = run.summary;

  // Unverified fails CI outright: a gate that could not look is not a gate.
  const errorCount = errors + unverified + (strict ? warnings : 0);

  return errorCount === 0 ? "ok" : "failed";
};

export default prepareOrchestrator(ciRunOrchestrator);
