import type { Orchestrator, StatusOptions } from "@/types.js";

import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import buildStatusReportService from "@/services/build-status-report-service.js";
import statusView from "@/views/status-view.js";

/**
 * What `praxis status` does: report the project's health.
 *
 * The one workflow that reaches into both layers — framework health from
 * the spec layer's documents, validation state from the eval layer's
 * cache. Fails when any structural issue is found, so CI fails on a
 * project whose taxonomy has drifted.
 */
export const analyzeProjectOrchestrator: Orchestrator<StatusOptions> = async (
  ctx,
  { json = false },
) => {
  const report = await buildStatusReportService(ctx.config, {});

  const view = statusView({ ...report, json });
  ctx.render(view);

  return report.issueCount > 0 ? "failed" : "ok";
};

export default prepareOrchestrator(analyzeProjectOrchestrator);
