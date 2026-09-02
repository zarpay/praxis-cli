import type { RunEvalOptions } from "@/domains/eval/types.js";
import type { Orchestrator } from "@/domains/workspace/types.js";

import { joinPath } from "@/core/paths.js";
import reviewAll from "@/domains/eval/services/review-all-service.js";
import reviewNamed from "@/domains/eval/services/review-named-service.js";
import selectReviewers from "@/domains/eval/services/select-reviewers-service.js";
import {
  progressEntries,
  reviewedTargetEntries,
  runHeadline,
  runReportLines,
  targetsHeadline,
} from "@/domains/eval/views/summary.js";
import { prepareOrchestrator } from "@/domains/workspace/prepare-orchestrator.js";
import { renderReport } from "@/views/report.js";

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
  { targets = [], ci = false, strict = false, cache = true, ...options },
) => {
  const { root, config, out } = ctx;

  if (targets.length > 0) {
    out.line(targetsHeadline(targets));

    const { errors } = await reviewNamed({
      targets,
      root,
      config,
      spec: options.spec,
      reviewer: options.reviewer,
      useCache: cache,
      onVerdict: (event) =>
        out.print(reviewedTargetEntries({ ...event, verbose: options.verbose ?? false })),
    });

    return errors === 0 ? "ok" : "failed";
  }

  out.line(runHeadline({ ci, type: options.type }));

  const run = await reviewAll({
    root,
    sources: config.sources,
    specFilePattern: config.specFilePattern,
    absoluteIgnore: config.ignore.map((pattern) => joinPath(root, pattern)),
    reviewers: selectReviewers({ configured: config.reviewers, only: options.reviewer }),
    type: options.type,
    failFast: options.failFast ?? false,
    useCache: cache,
    onProgress: (event) => out.print(progressEntries(event)),
  });

  renderReport(runReportLines(run, { cached: cache }), { out, logger: ctx.logger });

  const { errors, warnings } = run.summary;

  return errors + (strict ? warnings : 0) === 0 ? "ok" : "failed";
};

export default prepareOrchestrator(runEvalOrchestrator);
