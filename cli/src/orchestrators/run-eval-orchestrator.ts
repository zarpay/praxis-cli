import type { Orchestrator, ReviewNamedInput, RunEvalOptions } from "@/types.js";

import { gitFacts } from "@/helpers/git-helper.js";
import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import detectEpochBoundariesService from "@/services/detect-epoch-boundaries-service.js";
import reviewNamedService from "@/services/review-named-service.js";
import reviewProjectService from "@/services/review-project-service.js";
import selectReviewersService from "@/services/select-reviewers-service.js";
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
  const { root, config } = ctx;

  // Announce any epoch boundary before reviewing (02): warn, never block.
  const reviewers = selectReviewersService({
    configured: config.reviewers,
    only: options.reviewer,
  });
  const boundaries = detectEpochBoundariesService({ root, reviewers });
  const boundaryView = epochBoundaryView(boundaries);

  ctx.render(boundaryView);

  // Name the run's evidence grade before spending anything (12).
  const anchoringView = runAnchoringView(gitFacts(root));

  ctx.render(anchoringView);

  if (targets.length > 0) {
    const headlineView = evalHeadlineView({ targets });

    ctx.render(headlineView);

    const onTarget = (event: Parameters<NonNullable<ReviewNamedInput["onTarget"]>>[0]) => {
      const targetView = reviewedTargetView({ ...event, verbose: options.verbose ?? false });

      ctx.render(targetView);
    };

    const { errors } = await reviewNamedService({
      targets,
      root,
      config,
      spec: options.spec,
      reviewer: options.reviewer,
      useCache: cache,
      onTarget,
    });

    return errors === 0 ? "ok" : "failed";
  }

  const headlineView = evalHeadlineView({ type: options.type });

  ctx.render(headlineView);

  const onProgress = (event: Parameters<typeof runProgressView>[0]) => {
    const progressView = runProgressView(event);

    ctx.render(progressView);
  };

  const run = await reviewProjectService({
    config,
    reviewer: options.reviewer,
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
