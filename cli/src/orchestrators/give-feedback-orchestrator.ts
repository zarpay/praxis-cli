import type { GovernedUnit, Orchestrator, ReviewedTarget } from "@/types.js";

import { errors } from "@/helpers/errors-helper.js";
import { relativePath } from "@/helpers/paths-helper.js";
import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import resolveTargetUnitsService from "@/services/resolve-target-units-service.js";
import reviewUnitsService from "@/services/review-units-service.js";
import evalJsonView from "@/views/eval-json-view.js";
import feedbackHeadlineView from "@/views/feedback-headline-view.js";
import feedbackSummaryView from "@/views/feedback-summary-view.js";
import reviewedTargetView from "@/views/reviewed-target-view.js";
import { Waiting } from "@framework/views/waiting.js";

/** How `praxis feedback` was invoked. */
interface GiveFeedbackOptions {
  /** The file or directory to get feedback on. */
  target: string;
  /** Run only this configured reviewer. */
  reviewer?: string;
  /** Show each verdict's full reasoning. */
  verbose?: boolean;
  /** Whether to consult the verdict cache. */
  cache?: boolean;
  /** Emit the outcome as stable JSON on stdout. */
  json?: boolean;
}

/**
 * What `praxis feedback` does: review for the person writing the code,
 * not for the record.
 *
 * Same reviewers, same specs, same prose as `eval run` — and the run is
 * recorded in full, critiques and cost included, because the ledger
 * answers what has ever happened. What it never does is queue: the run
 * is stamped `scope: "advisory"`, and triage skips advisory critiques,
 * so a developer asking about the file they are editing cannot fill a
 * curator's backlog with code that was never finished.
 *
 * It also never writes the verdict cache. A cache hit writes no critique
 * record, so an advisory run that cached its verdict would silently
 * suppress the evidence the next measurement run was supposed to
 * produce — the one failure mode that would make this feature worse than
 * nothing.
 *
 * The target resolves to whatever units the specs say cover it, so a
 * directory works, and naming one file of a `by_directory` cohort
 * reviews the cohort — the unit the spec actually judges.
 *
 * Always exits 0. This is advice, not a gate; a build must not fail
 * because a developer asked a question.
 *
 * @throws PraxisError when no expert governs the target
 */
export const giveFeedbackOrchestrator: Orchestrator<GiveFeedbackOptions> = async (
  ctx,
  { target, reviewer, verbose = false, cache = true, json = false },
) => {
  const cfg = ctx.config;
  const units = resolveTargetUnitsService(cfg, { target });

  if (units.length === 0) throw errors.targetNotGoverned(target);

  if (!json) {
    const headline = feedbackHeadlineView({ target, units: describe(ctx.root, units) });
    ctx.render(headline);
  }

  const reviewed: ReviewedTarget[] = [];
  const waiting = new Waiting();
  const startedAt = Date.now();

  const onUnit = (event: ReviewedTarget) => {
    if (json) {
      reviewed.push(event);

      return;
    }

    const targetView = reviewedTargetView({ ...event, verbose });

    waiting.paused(() => ctx.render(targetView));
  };

  let run;

  try {
    run = await waiting.during(`Reviewing ${units.length} unit(s)`, () =>
      reviewUnitsService(cfg, {
        units,
        reviewer,
        useCache: cache,
        writeCache: false,
        scope: "advisory",
        onUnit,
      }),
    );
  } finally {
    waiting.close();
  }

  if (json) {
    const jsonView = evalJsonView({ kind: "targets", targets: reviewed });
    ctx.render(jsonView);

    return "ok";
  }

  const summary = feedbackSummaryView({ usage: run.usage, elapsedMs: Date.now() - startedAt });

  ctx.render(summary);

  return "ok";
};

export default prepareOrchestrator(giveFeedbackOrchestrator);

/** Each resolved unit as the reader should see it named. */
function describe(root: string, units: GovernedUnit[]): string[] {
  return units.map(({ unit }) => {
    const path = relativePath(root, unit.path);
    const cohort = unit.files.length > 1 || unit.files[0] !== unit.path;

    return cohort ? `${path} (cohort · ${unit.files.length} files)` : path;
  });
}
