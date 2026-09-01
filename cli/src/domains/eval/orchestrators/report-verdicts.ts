import type { ReportVerdictsOptions } from "@/domains/eval/types.js";
import type { CommandContext } from "@/domains/workspace/models/command-context.js";

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
export default async function reportVerdicts(
  ctx: CommandContext,
  { target, verbose = false }: ReportVerdictsOptions,
): Promise<void> {
  const { reports, named } = collectVerdictReports({
    targetPath: target,
    root: ctx.root,
    config: ctx.config,
  });

  renderReport(verdictReportsLines(reports, { named, verbose }), {
    out: ctx.out,
    logger: ctx.logger,
  });
}
