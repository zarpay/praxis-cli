import type { CommandContext } from "@/models/command-context.js";
import type { PraxisConfig } from "@/models/praxis-config.js";
import type { Orchestrator, TriageRecord } from "@/types.js";

import { errors } from "@/helpers/errors-helper.js";
import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import buildCritiquesReportService from "@/services/build-critiques-report-service.js";
import { RunStore } from "@/stores/run-store.js";
import { TriageStore } from "@/stores/triage-store.js";
import reviewCritiqueView from "@/views/review-critique-view.js";
import reviewSummaryView from "@/views/review-summary-view.js";
import { Prompter } from "@framework/views/prompter.js";

/** Options for `praxis eval review [target]`. */
interface ReviewCritiquesOptions {
  /** Project-relative path prefix narrowing the session. */
  target?: string;
  /** Scripted: dismiss this one critique (needs --reason). */
  dismiss?: string;
  /** Scripted: lift this one critique's dismissal (needs --reason). */
  reinstate?: string;
  reason?: string;
}

/**
 * What `praxis eval review` does: the human judges critique
 * **validity** — did the reviewer say something true and grounded?
 * This is the only place a critique is dismissed. A dismissed critique
 * is not evidence: it leaves every queue, is never labeled, and stays
 * that way until reinstated. The dismissal rate is the reviewer-trust
 * signal — many dismissals mean the specs disagree with the humans or
 * the reviewers are drifting.
 *
 * The interactive queue is what no axiom has claimed: untriaged and
 * unmatched critiques. A labeled critique is presumed valid — someone
 * found it an instance of a standard — but presumption is not
 * finality: the scripted `--dismiss <id> --reason` accepts ANY
 * critique, labeled included, and the dismissal wins at read time (the
 * label stays in the ledger beneath it; reports recompute). Browse
 * labeled ids with `praxis eval critiques --axiom <id>`.
 * `--reinstate <id> --reason` lifts a dismissal — the critique returns
 * to whatever its records beneath say: its label, or its queue.
 *
 * @throws PraxisError for an unknown id, a flag missing its reason, or
 *   interactive use without a TTY
 */
export const reviewCritiquesOrchestrator: Orchestrator<ReviewCritiquesOptions> = async (
  ctx,
  { target, dismiss, reinstate, reason },
) => {
  const cfg = ctx.config;

  if (dismiss !== undefined) return dismissOne(ctx, dismiss, reason);

  if (reinstate !== undefined) return reinstateOne(ctx, reinstate, reason);

  const prompter = new Prompter();

  if (!prompter.interactive) {
    throw errors.notATty("praxis eval review", '--dismiss <critique-id> --reason "<why>"');
  }

  const report = buildCritiquesReportService(cfg, { target });
  const queue = report.rows.filter((row) => isReviewable(row.state));

  if (queue.length === 0) {
    prompter.close();
    ctx.render([{ channel: "content", entries: ["Nothing to review."] }]);

    return "ok";
  }

  const records: TriageRecord[] = [];
  let reviewed = 0;

  for (const [index, row] of queue.entries()) {
    const card = reviewCritiqueView({ ...row, index: index + 1, total: queue.length });
    ctx.render(card);

    const choice = await prompter.choose("[d]ismiss / [n]ext / [q]uit", [
      "dismiss",
      "next",
      "quit",
    ]);

    if (choice === "quit") break;

    reviewed++;

    if (choice === "next") continue;

    const why = await prompter.ask("Why is this critique invalid?");
    records.push(dismissalRecord(row.id, why === "" ? "dismissed at review" : why));
  }

  prompter.close();

  if (records.length > 0) new TriageStore(cfg).writeSession(records);

  const summary = reviewSummaryView({
    reviewed,
    dismissed: records.length,
    remaining: queue.length - reviewed,
    dismissedTotal: report.totals.dismissed + records.length,
    critiquesTotal: report.rows.length,
  });
  ctx.render(summary);

  return "ok";
};

export default prepareOrchestrator(reviewCritiquesOrchestrator);

/** The scripted dismissal of one critique. */
function dismissOne(ctx: CommandContext, id: string, reason: string | undefined): "ok" {
  const cfg = ctx.config;

  if (reason === undefined) {
    throw errors.missingOption(
      "--dismiss",
      "--reason",
      `praxis eval review --dismiss ${id} --reason "<why>"`,
    );
  }

  requireCritique(cfg, id);

  if (new TriageStore(cfg).decisions().get(id)?.dismissed) {
    ctx.render([{ channel: "warning", text: `${id} is already dismissed; nothing to do.` }]);

    return "ok";
  }

  new TriageStore(cfg).writeSession([dismissalRecord(id, reason)]);
  ctx.render([
    {
      channel: "success",
      text: `${id} dismissed: ${reason}. It is no longer evidence — out of every queue, never labeled — until reinstated.`,
    },
  ]);

  return "ok";
}

/** The scripted reinstatement of one dismissed critique. */
function reinstateOne(
  ctx: CommandContext,
  id: string,
  reason: string | undefined,
): "ok" | "failed" {
  const cfg = ctx.config;

  if (reason === undefined) {
    throw errors.missingOption(
      "--reinstate",
      "--reason",
      `praxis eval review --reinstate ${id} --reason "<why>"`,
    );
  }

  requireCritique(cfg, id);
  const store = new TriageStore(cfg);
  const decision = store.decisions().get(id);

  if (!decision?.dismissed) {
    ctx.render([{ channel: "warning", text: `${id} is not dismissed; nothing to reinstate.` }]);

    return "failed";
  }

  store.writeSession([
    { kind: "reinstatement", critique_id: id, reason, timestamp: new Date().toISOString() },
  ]);
  ctx.render([
    {
      channel: "success",
      text: `${id} reinstated: ${reason}. It is evidence again and returns to the queue its records put it in.`,
    },
  ]);

  return "ok";
}

/** Untriaged or unmatched: no axiom has claimed the critique, so validity is still open. */
function isReviewable(state: string): boolean {
  return state === "untriaged" || state === "unmatched";
}

/** @throws PraxisError when no ledger critique carries the id */
function requireCritique(cfg: PraxisConfig, id: string): void {
  const known = new RunStore(cfg).critiques().some((critique) => critique.id === id);

  if (!known) throw errors.critiqueNotFound(id);
}

/** One dismissal record, stamped now. */
function dismissalRecord(critiqueId: string, reason: string): TriageRecord {
  return {
    kind: "dismissal",
    critique_id: critiqueId,
    reason,
    timestamp: new Date().toISOString(),
  };
}
