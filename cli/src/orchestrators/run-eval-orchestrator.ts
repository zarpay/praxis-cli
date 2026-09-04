import type { EvalProgress, Orchestrator, ReviewedTarget } from "@/types.js";

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
import evalJsonView from "@/views/eval-json-view.js";
import reviewedTargetView from "@/views/reviewed-target-view.js";
import runAnchoringView from "@/views/run-anchoring-view.js";
import runProgressView from "@/views/run-progress-view.js";
import runReportView from "@/views/run-report-view.js";

/** How `praxis eval run` and `praxis eval ci` were invoked. */
interface RunEvalOptions {
  /** Targets named on the command line; empty means a full run. */
  targets?: string[];
  /** Restrict a full run to one domain type. */
  type?: string;
  /** Run only this configured reviewer. */
  reviewer?: string;
  /** Spec path for a single named target. */
  spec?: string;
  /** Show each verdict's full reasoning. */
  verbose?: boolean;
  /** Stop a full run at the first error verdict. */
  failFast?: boolean;
  /** Whether to consult the verdict cache. */
  cache?: boolean;
  /** Review the branch against its merge-base; a string names the base ref. */
  diff?: boolean | string;
  /** Emit the outcome as stable JSON on stdout (08-g, 09-af). */
  json?: boolean;
}

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

    if (!options.json) {
      const headlineView = diffHeadlineView(diff);
      ctx.render(headlineView);
    }

    if (diff.targets.length === 0) {
      const emptyView = options.json
        ? evalJsonView({ kind: "diff", result: emptyDiffResult() })
        : [{ channel: "content" as const, entries: ["No spec-covered files changed."] }];
      ctx.render(emptyView);

      return "ok";
    }

    const onProgress = (event: EvalProgress) => {
      const progressView = runProgressView(event);
      ctx.render(progressView);
    };

    const run = await reviewDiffService(cfg, {
      reviewers,
      diff,
      useCache: cache,
      onProgress: options.json ? undefined : onProgress,
    });

    const reportView = options.json
      ? evalJsonView({
          kind: "diff",
          result: run,
          base: diff.baseSha,
          head: diff.headSha,
          uncovered: diff.uncovered,
        })
      : diffReportView(run);
    ctx.render(reportView);

    // The diff is judged on its own contribution (12): introduced
    // errors or an incomparable target fail; inherited debt never does.
    return run.summary.errorsIntroduced + run.summary.unverified === 0 ? "ok" : "failed";
  }

  if (targets.length > 0) {
    if (!options.json) {
      const headlineView = evalHeadlineView({ targets });
      ctx.render(headlineView);
    }

    const reviewed: ReviewedTarget[] = [];

    const onTarget = (event: ReviewedTarget) => {
      if (options.json) {
        reviewed.push(event);

        return;
      }

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

    if (options.json) {
      const jsonView = evalJsonView({ kind: "targets", targets: reviewed });
      ctx.render(jsonView);
    }

    return errors === 0 ? "ok" : "failed";
  }

  if (!options.json) {
    const headlineView = evalHeadlineView({ type: options.type });
    ctx.render(headlineView);
  }

  const onProgress = (event: EvalProgress) => {
    const progressView = runProgressView(event);

    ctx.render(progressView);
  };

  const run = await reviewAllService(cfg, {
    reviewers,
    type: options.type,
    failFast: options.failFast ?? false,
    useCache: cache,
    onProgress: options.json ? undefined : onProgress,
  });

  const reportView = options.json
    ? evalJsonView({ kind: "corpus", summary: run.summary, cacheStats: run.cacheStats })
    : runReportView({ run, cached: cache });

  ctx.render(reportView);

  // A run that could not look at everything cannot claim clean (03).
  return run.summary.errors + run.summary.unverified === 0 ? "ok" : "failed";
};

export default prepareOrchestrator(runEvalOrchestrator);

/** The empty diff outcome, so `--json` emits the contract even with nothing covered. */
function emptyDiffResult() {
  return {
    perTarget: [],
    summary: { introduced: 0, resolved: 0, inherited: 0, errorsIntroduced: 0, unverified: 0 },
    cacheStats: { hits: 0, misses: 0 },
  };
}
