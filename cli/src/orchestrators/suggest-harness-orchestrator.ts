import type { Orchestrator } from "@/types.js";

import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import buildHarnessBriefService from "@/services/build-harness-brief-service.js";
import resolveReportScopeService from "@/services/resolve-report-scope-service.js";
import harnessBriefView from "@/views/harness-brief-view.js";

/** What `praxis harness suggest` parses. */
interface SuggestHarnessOptions {
  /** Only runs at or after this ISO date, or a git ref's commit date. */
  since?: string;
  /** Only runs recorded on this branch. */
  branch?: string;
  json?: boolean;
}

/**
 * What `praxis harness suggest` does (08): assemble the brief — the
 * evidence about which harness elements to change — from the ledger and
 * the metrics reads. Pure read; the drafting belongs to the generated
 * /praxis-harness command, and the ratification to a human.
 */
export const suggestHarnessOrchestrator: Orchestrator<SuggestHarnessOptions> = async (
  ctx,
  options,
) => {
  const cfg = ctx.config;
  const scoped = resolveReportScopeService(cfg, { since: options.since, branch: options.branch });
  const brief = buildHarnessBriefService(cfg, { scoped });

  const view = harnessBriefView({ ...brief, json: options.json });
  ctx.render(view);

  return "ok";
};

export default prepareOrchestrator(suggestHarnessOrchestrator);
