import type { CiRunOptions } from "@/eval/types.js";
import type { Orchestrator } from "@/workspace/types.js";

import reviewProject from "@/eval/services/review-project-service.js";
import { progressEntries, runHeadline, runReportLines } from "@/eval/views/summary.js";
import { renderReport } from "@/framework/views/report.js";
import { prepareOrchestrator } from "@/workspace/prepare-orchestrator.js";

/**
 * What `praxis eval ci` does: one full review, framed for CI.
 *
 * Always a full run — CI has no targets to name — and always cached, so
 * a pipeline pays only for what changed. `--strict` is the only thing it
 * takes: whether warnings count as failure alongside errors.
 */
export const ciRunOrchestrator: Orchestrator<CiRunOptions> = async (ctx, { strict = false }) => {
  const { root, config, out } = ctx;

  out.line(runHeadline({ ci: true }));

  const run = await reviewProject({
    root,
    config,
    onProgress: (event) => out.print(progressEntries(event)),
  });

  renderReport(runReportLines(run, { cached: true }), { out, logger: ctx.logger });

  const { errors, warnings } = run.summary;

  return errors + (strict ? warnings : 0) === 0 ? "ok" : "failed";
};

export default prepareOrchestrator(ciRunOrchestrator);
