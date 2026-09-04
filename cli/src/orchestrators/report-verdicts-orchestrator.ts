import type { Orchestrator } from "@/types.js";

import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import collectVerdictReportsService from "@/services/collect-verdict-reports-service.js";
import verdictReportsView from "@/views/verdict-reports-view.js";

/** What `praxis eval verdict` was asked for. */
interface ReportVerdictsOptions {
  /** The target whose cached verdicts to show. */
  target: string;
  /** Show each verdict's full reasoning. */
  verbose?: boolean;
  /** Emit the reports as stable JSON instead. */
  json?: boolean;
}

/**
 * What `praxis eval verdict` does: show what every reviewer last recorded
 * about one target, without an API call.
 *
 * @throws PraxisError when the target does not exist, or no reviewer is
 *   configured to have an opinion about it
 */
export const reportVerdictsOrchestrator: Orchestrator<ReportVerdictsOptions> = async (
  ctx,
  { target, verbose = false, json = false },
) => {
  const { reports, named } = collectVerdictReportsService(ctx.config, { targetPath: target });

  const view = verdictReportsView({ reports, named, verbose, json });

  ctx.render(view);

  return "ok";
};

export default prepareOrchestrator(reportVerdictsOrchestrator);
