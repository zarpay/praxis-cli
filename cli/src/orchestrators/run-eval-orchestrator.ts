import type { RunEvalOptions } from "@/types.js";
import type { Orchestrator } from "@/types.js";

import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import reviewNamed from "@/services/review-named-service.js";
import reviewProject from "@/services/review-project-service.js";
import {
  progressEntries,
  reviewedTargetEntries,
  runHeadline,
  runReportLines,
  targetsHeadline,
} from "@/views/summary.js";
import { renderReport } from "@framework/views/report.js";

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

  out.line(runHeadline({ type: options.type }));

  const run = await reviewProject({
    root,
    config,
    reviewer: options.reviewer,
    type: options.type,
    failFast: options.failFast ?? false,
    useCache: cache,
    onProgress: (event) => out.print(progressEntries(event)),
  });

  renderReport(runReportLines(run, { cached: cache }), { out, logger: ctx.logger });

  return run.summary.errors === 0 ? "ok" : "failed";
};

export default prepareOrchestrator(runEvalOrchestrator);
