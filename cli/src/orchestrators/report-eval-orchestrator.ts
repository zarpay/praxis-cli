import type { EvalReportOptions, Orchestrator } from "@/types.js";

import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import buildAxiomReportService from "@/services/build-axiom-report-service.js";
import buildEvalReportService from "@/services/build-eval-report-service.js";
import resolveReportScopeService from "@/services/resolve-report-scope-service.js";
import axiomReportView from "@/views/axiom-report-view.js";
import evalReportView from "@/views/eval-report-view.js";

/**
 * What `praxis eval report` does: read the ledger, compute under 07's
 * hard rules, render — never a reviewer call, never a write. Scopes
 * compose (files/glob, --since, --branch, --commit/--commits); --axiom
 * switches to the single-axiom drill-down.
 */
export const reportEvalOrchestrator: Orchestrator<EvalReportOptions> = async (ctx, options) => {
  const cfg = ctx.config;

  const scoped = resolveReportScopeService(cfg, {
    target: options.target,
    since: options.since,
    branch: options.branch,
    commit: options.commit,
    commits: options.commits,
  });

  if (options.axiom) {
    const report = buildAxiomReportService(cfg, { scoped, axiomId: options.axiom });
    const view = axiomReportView({ ...report, json: options.json ?? false });

    ctx.render(view);

    return "ok";
  }

  const report = buildEvalReportService(cfg, { scoped });
  const view = evalReportView({ ...report, json: options.json ?? false });

  ctx.render(view);

  return "ok";
};

export default prepareOrchestrator(reportEvalOrchestrator);
