import type { Orchestrator } from "@/types.js";

import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import buildCritiquesReportService from "@/services/build-critiques-report-service.js";
import critiquesView from "@/views/critiques-view.js";

/** Options for `praxis eval critiques [target]`. */
interface ListCritiquesOptions {
  target?: string;
  axiom?: string;
  state?: "untriaged" | "unmatched" | "labeled" | "dismissed";
  json?: boolean;
}

/**
 * What `praxis eval critiques` does: list the ledger's critiques with
 * their ids and lifecycle states — the browsing surface for
 * `axioms reassign`, and the drill-down under every queue count. Pure
 * read; never a reviewer or curator call.
 */
export const listCritiquesOrchestrator: Orchestrator<ListCritiquesOptions> = async (
  ctx,
  { target, axiom, state, json },
) => {
  const report = buildCritiquesReportService(ctx.config, { target, axiom, state });

  const view = critiquesView({ ...report, json });
  ctx.render(view);

  return "ok";
};

export default prepareOrchestrator(listCritiquesOrchestrator);
