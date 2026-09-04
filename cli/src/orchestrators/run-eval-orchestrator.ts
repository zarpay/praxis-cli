import type { EvalProgress, Orchestrator, ReviewedTarget, RunEvalOptions } from "@/types.js";

import { errors } from "@/helpers/errors-helper.js";
import { gitFacts } from "@/helpers/git-helper.js";
import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import detectEpochBoundariesService from "@/services/detect-epoch-boundaries-service.js";
import resolveDiffService from "@/services/resolve-diff-service.js";
import reviewAllService from "@/services/review-all-service.js";
import reviewDiffService from "@/services/review-diff-service.js";
import reviewNamedService from "@/services/review-named-service.js";
import selectReviewersService from "@/services/select-reviewers-service.js";
import diffHeadlineView from "@/views/diff-headline-view.js";
import diffReportView from "@/views/diff-report-view.js";
import epochBoundaryView from "@/views/epoch-boundary-view.js";
import evalHeadlineView from "@/views/eval-headline-view.js";
import reviewedTargetView from "@/views/reviewed-target-view.js";
import runAnchoringView from "@/views/run-anchoring-view.js";
import runProgressView from "@/views/run-progress-view.js";
import runReportView from "@/views/run-report-view.js";

/**
 * What `praxis eval run` and `praxis eval ci` do: review targets against
 * their specs.
 *
 * Two shapes of the same job. Named targets are reviewed directly, each
 * verdict rendered as it lands. With no targets it is a full run: every
 * spec discovered, every unit reviewed by every selected reviewer, with a
 * summary at the end.
 *
 * Fails on any error verdict — and in CI `--strict`, on warnings too.
 */
export const runEvalOrchestrator: Orchestrator<RunEvalOptions> = async (
  ctx,
  { targets = [], cache = true, ...options },
) => {
  const { root } = ctx;
  const cfg = ctx.config;

  // Announce any epoch boundary before reviewing (02): warn, never block.
  const reviewers = selectReviewersService(cfg, { only: options.reviewer });
  const boundaries = detectEpochBoundariesService(cfg, { reviewers });
  const boundaryView = epochBoundaryView(boundaries);

  ctx.render(boundaryView);

  // Name the run's evidence grade before spending anything (12).
  const anchoringView = runAnchoringView(gitFacts(root));

  ctx.render(anchoringView);

  if (options.diff) {
    if (targets.length > 0) throw errors.diffWithTargets();

    const diff = resolveDiffService(cfg, {
      base: typeof options.diff === "string" ? options.diff : undefined,
    });

    const headlineView = diffHeadlineView(diff);
    ctx.render(headlineView);

    if (diff.targets.length === 0) {
      ctx.render([{ channel: "content", entries: ["No spec-covered files changed."] }]);

      return "ok";
    }

    const onProgress = (event: EvalProgress) => {
      const progressView = runProgressView(event);
      ctx.render(progressView);
    };

    const run = await reviewDiffService(cfg, { reviewers, diff, useCache: cache, onProgress });

    const reportView = diffReportView(run);
    ctx.render(reportView);

    // The diff is judged on its own contribution (12): introduced
    // errors or an incomparable target fail; inherited debt never does.
    return run.summary.errorsIntroduced + run.summary.unverified === 0 ? "ok" : "failed";
  }

  if (targets.length > 0) {
    const headlineView = evalHeadlineView({ targets });

    ctx.render(headlineView);

    const onTarget = (event: ReviewedTarget) => {
      const targetView = reviewedTargetView({ ...event, verbose: options.verbose ?? false });

      ctx.render(targetView);
    };

    const { errors } = await reviewNamedService(cfg, {
      targets,
      spec: options.spec,
      reviewer: options.reviewer,
      useCache: cache,
      onTarget,
    });

    return errors === 0 ? "ok" : "failed";
  }

  const headlineView = evalHeadlineView({ type: options.type });

  ctx.render(headlineView);

  const onProgress = (event: EvalProgress) => {
    const progressView = runProgressView(event);

    ctx.render(progressView);
  };

  const run = await reviewAllService(cfg, {
    reviewers,
    type: options.type,
    failFast: options.failFast ?? false,
    useCache: cache,
    onProgress,
  });

  const reportView = runReportView({ run, cached: cache });

  ctx.render(reportView);

  // A run that could not look at everything cannot claim clean (03).
  return run.summary.errors + run.summary.unverified === 0 ? "ok" : "failed";
};

export default prepareOrchestrator(runEvalOrchestrator);
