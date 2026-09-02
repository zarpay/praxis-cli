import type { Orchestrator } from "@/types.js";

import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import buildStatusReport from "@/services/build-status-report-service.js";
import countStatusIssues from "@/services/count-status-issues-service.js";
import { statusReport } from "@/views/status.js";
import { renderReport } from "@framework/views/report.js";

/**
 * What `praxis status` does: report the project's health.
 *
 * The one workflow that reaches into both layers — framework health from
 * the spec layer's documents, validation state from the eval layer's
 * cache. Fails when any structural issue is found, so CI fails on a
 * project whose taxonomy has drifted.
 */
export const analyzeProjectOrchestrator: Orchestrator = async (ctx) => {
  const report = await buildStatusReport({ root: ctx.root, config: ctx.config });

  renderReport(statusReport(report), { out: ctx.out, logger: ctx.logger });

  return countStatusIssues(report) > 0 ? "failed" : "ok";
};

export default prepareOrchestrator(analyzeProjectOrchestrator);
