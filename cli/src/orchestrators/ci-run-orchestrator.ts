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

  ctx.render(evalHeadlineView({ ci: true }));

  const run = await reviewProject({
    root,
    config,
    onProgress: (event) => ctx.render(runProgressView(event)),
  });

  ctx.render(runReportView({ run, cached: true }));

  const { errors, warnings } = run.summary;

  return errors + (strict ? warnings : 0) === 0 ? "ok" : "failed";
};

export default prepareOrchestrator(ciRunOrchestrator);
