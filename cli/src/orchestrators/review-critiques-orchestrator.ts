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
  /** Scripted: dismiss these critiques, one reason for all (needs --reason). */
  dismiss?: string[];
  /** Scripted: lift these critiques' dismissals, one reason for all (needs --reason). */
  reinstate?: string[];
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

  if (dismiss !== undefined) return dismissMany(ctx, dismiss, reason);

  if (reinstate !== undefined) return reinstateMany(ctx, reinstate, reason);

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

    // "all" is keyed [r]est rather than a capital D: choose() matches on
    // the first character case-insensitively, so [d] and [D] are one key.
    const choice = await prompter.choose(
      "[d]ismiss / [r]est — dismiss all remaining / [n]ext / [q]uit",
      ["dismiss", "rest", "next", "quit"],
    );

    if (choice === "quit") break;

    if (choice === "next") {
      reviewed++;
      continue;
    }

    if (choice === "rest") {
      const why = await prompter.ask(`Why are these ${queue.length - index} critique(s) invalid?`);
      const shared = why === "" ? "dismissed at review" : why;

      for (const remaining of queue.slice(index)) {
        records.push(dismissalRecord(remaining.id, shared));
        reviewed++;
      }

      break;
    }

    reviewed++;

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

/**
 * The scripted dismissal of one or more critiques, under one reason.
 *
 * A curate cluster is the case this exists for: the whole grouping is
 * invalid for the same reason, and naming that reason once beats typing
 * it eight times. Each critique still gets its own dismissal record —
 * the batch is an input convenience, never a record shape — so reports,
 * reinstatement and the join read exactly as they always did.
 */
function dismissMany(ctx: CommandContext, ids: string[], reason: string | undefined): "ok" {
  const cfg = ctx.config;

  if (reason === undefined) {
    throw errors.missingOption(
      "--dismiss",
      "--reason",
      `praxis eval review --dismiss ${ids.join(" ")} --reason "<why>"`,
    );
  }

  // Every id is checked before anything is written: a typo in the
  // fifth id must not leave the first four dismissed.
  for (const id of ids) requireCritique(cfg, id);

  const store = new TriageStore(cfg);
  const decisions = store.decisions();
  const already = ids.filter((id) => decisions.get(id)?.dismissed);
  const fresh = ids.filter((id) => !decisions.get(id)?.dismissed);

  if (already.length > 0) {
    ctx.render([
      {
        channel: "warning",
        text: `Already dismissed, left alone: ${already.join(", ")}.`,
      },
    ]);
  }

  if (fresh.length === 0) return "ok";

  store.writeSession(fresh.map((id) => dismissalRecord(id, reason)));

  const dismissedSubject = fresh.length === 1 ? fresh[0] : `${fresh.length} critiques`;

  ctx.render([
    {
      channel: "success",
      text: `${dismissedSubject} dismissed: ${reason}. No longer evidence — out of every queue, never labeled — until reinstated.${fresh.length === 1 ? "" : ` (${fresh.join(", ")})`}`,
    },
  ]);

  return "ok";
}

/** The scripted reinstatement of one or more critiques, under one reason. */
function reinstateMany(
  ctx: CommandContext,
  ids: string[],
  reason: string | undefined,
): "ok" | "failed" {
  const cfg = ctx.config;

  if (reason === undefined) {
    throw errors.missingOption(
      "--reinstate",
      "--reason",
      `praxis eval review --reinstate ${ids.join(" ")} --reason "<why>"`,
    );
  }

  for (const id of ids) requireCritique(cfg, id);

  const store = new TriageStore(cfg);
  const decisions = store.decisions();
  const dismissed = ids.filter((id) => decisions.get(id)?.dismissed);
  const standing = ids.filter((id) => !decisions.get(id)?.dismissed);

  if (standing.length > 0) {
    ctx.render([
      {
        channel: "warning",
        text: `${standing.join(", ")} is not dismissed; nothing to reinstate.`,
      },
    ]);
  }

  if (dismissed.length === 0) return "failed";

  store.writeSession(
    dismissed.map((id) => ({
      kind: "reinstatement" as const,
      critique_id: id,
      reason,
      timestamp: new Date().toISOString(),
    })),
  );
  const reinstatedSubject = dismissed.length === 1 ? dismissed[0] : `${dismissed.length} critiques`;

  ctx.render([
    {
      channel: "success",
      text: `${reinstatedSubject} reinstated: ${reason}. Evidence again, back in the queue their records put them in.${dismissed.length === 1 ? "" : ` (${dismissed.join(", ")})`}`,
    },
  ]);

  return "ok";
}

/**
 * Untriaged or unmatched: no axiom has claimed the critique, so validity
 * is still open. Advisory critiques are excluded by the same test — they
 * are evidence for nothing, so judging one invalid decides nothing.
 */
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
