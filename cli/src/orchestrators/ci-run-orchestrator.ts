import type { CiRunOptions } from "@/types.js";
import type { Orchestrator } from "@/types.js";

import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import reviewProject from "@/services/review-project-service.js";
import { progressEntries, runHeadline, runReportLines } from "@/views/summary.js";
import { renderReport } from "@framework/views/report.js";

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
