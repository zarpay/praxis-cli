import type { ReportVerdictsOptions } from "@/domains/eval/types.js";
import type { Orchestrator } from "@/domains/workspace/types.js";

import collectVerdictReports from "@/domains/eval/services/collect-verdict-reports.js";
import { verdictReportsLines } from "@/domains/eval/views/summary.js";
import { renderReport } from "@/views/report.js";

/**
 * What `praxis eval verdict` does: show what every reviewer last recorded
 * about one target, without an API call.
 *
 * @throws PraxisError when the target does not exist, or no reviewer is
 *   configured to have an opinion about it
 */
const reportVerdicts: Orchestrator<ReportVerdictsOptions> = async (
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

export default reportVerdicts;
