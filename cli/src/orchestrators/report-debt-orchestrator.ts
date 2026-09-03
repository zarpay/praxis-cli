import type { DebtReportOptions, Orchestrator } from "@/types.js";

import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import buildDebtReportService from "@/services/build-debt-report-service.js";
import debtReportView from "@/views/debt-report-view.js";

/**
 * What `praxis debt report` does: render the P1 surface — baseline
 * stock, corpus paydown, concentration, re-baseline deltas (02). Reads
 * the ledger only; never a reviewer call, never a write.
 */
export const reportDebtOrchestrator: Orchestrator<DebtReportOptions> = async (
  ctx,
  { json = false },
) => {
  const report = buildDebtReportService({ root: ctx.root });
  const view = debtReportView({ ...report, json });

  ctx.render(view);

  return "ok";
};

export default prepareOrchestrator(reportDebtOrchestrator);
