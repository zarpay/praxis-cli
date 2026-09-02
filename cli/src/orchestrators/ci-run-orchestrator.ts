import type { CiRunOptions } from "@/types.js";
import type { Orchestrator } from "@/types.js";

import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import reviewProject from "@/services/review-project-service.js";
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
  const { root, config } = ctx;

  const evalView = evalHeadlineView({ ci: true });
  ctx.render(evalView);

  // The progress event is emitted when a target is reviewed, and the
  // verdict is available. It is emitted for every target, so the view
  // can be updated in real time.
  const onProgress = (event: Parameters<typeof runProgressView>[0]) => {
    const progressView = runProgressView(event);
    ctx.render(progressView);
  };

  const run = await reviewProject({
    root,
    config,
    onProgress,
  });

  const reportView = runReportView({ run, cached: true });
  ctx.render(reportView);

  const { errors, warnings } = run.summary;

  const errorCount = errors + (strict ? warnings : 0);

  return errorCount === 0 ? "ok" : "failed";
};

export default prepareOrchestrator(ciRunOrchestrator);
