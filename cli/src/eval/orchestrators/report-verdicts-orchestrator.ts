import type { ReportVerdictsOptions } from "@/eval/types.js";
import type { Orchestrator } from "@/workspace/types.js";

import collectVerdictReports from "@/eval/services/collect-verdict-reports-service.js";
import { verdictReportsLines } from "@/eval/views/summary.js";
import { renderReport } from "@/framework/views/report.js";
import { prepareOrchestrator } from "@/workspace/prepare-orchestrator.js";

/**
 * What `praxis eval verdict` does: show what every reviewer last recorded
 * about one target, without an API call.
 *
 * @throws PraxisError when the target does not exist, or no reviewer is
 *   configured to have an opinion about it
 */
export const reportVerdictsOrchestrator: Orchestrator<ReportVerdictsOptions> = async (
  ctx,
  { target, verbose = false },
) => {
  const { reports, named } = collectVerdictReports({
    targetPath: target,
    root: ctx.root,
    config: ctx.config,
  });

  renderReport(verdictReportsLines(reports, { named, verbose }), {
    out: ctx.out,
    logger: ctx.logger,
  });
};

export default prepareOrchestrator(reportVerdictsOrchestrator);
