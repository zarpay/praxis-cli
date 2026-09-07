import type { Orchestrator } from "@/types.js";

import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import deriveTriageStateService from "@/services/derive-triage-state-service.js";
import labelCritiquesService from "@/services/label-critiques-service.js";
import labelProgressView from "@/views/label-progress-view.js";
import labelReportView from "@/views/label-report-view.js";

/** What `praxis axioms triage` parses. */
interface TriageAxiomsOptions {
  /** Propose labels without writing anything. */
  dryRun: boolean;
}

/**
 * What `praxis axioms triage` does (04, review→label): categorize the
 * **untriaged** critiques — the ones never considered, or considered
 * against an axiom set that has since changed — one curator call each.
 * A match becomes a matcher assignment record; a no-match becomes an
 * unmatched record, moving the critique to curate's queue. Without a
 * curator it warns and does nothing: labeling is deferred, never faked.
 */
export const triageAxiomsOrchestrator: Orchestrator<TriageAxiomsOptions> = async (
  ctx,
  { dryRun },
) => {
  const cfg = ctx.config;
  const { pending, unidentified } = deriveTriageStateService(cfg, {});

  if (pending.length === 0) {
    const curateNote =
      unidentified.length > 0
        ? ` ${unidentified.length} unmatched critique(s) await \`praxis axioms curate\`.`
        : "";
    ctx.render([{ channel: "success", text: `Nothing untriaged.${curateNote}` }]);

    return "ok";
  }

  if (!cfg.curator) {
    ctx.logger.warn(
      `${pending.length} critique(s) untriaged, but no curator is configured — labeling is deferred. ` +
        "Add a curator to .praxis/config.json to label the backlog, or work it by hand with `praxis axioms curate`.",
    );

    return "ok";
  }

  ctx.logger.info(`Labeling ${pending.length} untriaged critique(s)${dryRun ? " (dry run)" : ""}`);

  const result = await labelCritiquesService(cfg, {
    pending,
    dryRun,
    onProgress: (event) => {
      const progressView = labelProgressView(event);
      ctx.render(progressView);
    },
  });

  const view = labelReportView({ ...result, dryRun });
  ctx.render(view);

  return "ok";
};

export default prepareOrchestrator(triageAxiomsOrchestrator);
