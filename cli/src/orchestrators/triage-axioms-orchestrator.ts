import type { Orchestrator } from "@/types.js";

import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import deriveTriageStateService from "@/services/derive-triage-state-service.js";
import labelCritiquesService from "@/services/label-critiques-service.js";
import labelReportView from "@/views/label-report-view.js";

/** What `praxis axioms triage` parses. */
interface TriageAxiomsOptions {
  /** Propose labels without writing anything. */
  dryRun: boolean;
}

/**
 * What `praxis axioms triage` does (04, review→label): batch-label the
 * pending critique backlog against the active axioms — the async
 * labeling pass. Confident matches become matcher assignment records;
 * the residue stays pending for `praxis axioms curate`. Without a
 * curator it warns and does nothing: labeling is deferred, never faked.
 */
export const triageAxiomsOrchestrator: Orchestrator<TriageAxiomsOptions> = async (
  ctx,
  { dryRun },
) => {
  const cfg = ctx.config;
  const { pending } = deriveTriageStateService(cfg, {});

  if (pending.length === 0) {
    ctx.render([{ channel: "success", text: "Nothing pending — the critique backlog is empty" }]);

    return "ok";
  }

  if (!cfg.curator) {
    ctx.logger.warn(
      `${pending.length} critique(s) pending, but no curator is configured — labeling is deferred. ` +
        "Add a curator to .praxis/config.json to label the backlog, or work it by hand with `praxis axioms curate`.",
    );

    return "ok";
  }

  ctx.logger.info(`Labeling ${pending.length} pending critique(s)${dryRun ? " (dry run)" : ""}`);

  const result = await labelCritiquesService(cfg, { pending, dryRun });

  const view = labelReportView({ ...result, dryRun });
  ctx.render(view);

  return "ok";
};

export default prepareOrchestrator(triageAxiomsOrchestrator);
