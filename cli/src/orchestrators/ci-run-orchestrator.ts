import type { CommandContext } from "@/models/command-context.js";
import type { PraxisConfig } from "@/models/praxis-config.js";
import type { CiRunOptions, EvalProgress } from "@/types.js";
import type { Orchestrator } from "@/types.js";

import { gitFacts } from "@/helpers/git-helper.js";
import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import detectEpochBoundariesService from "@/services/detect-epoch-boundaries-service.js";
import resolveDiffService from "@/services/resolve-diff-service.js";
import reviewAllService from "@/services/review-all-service.js";
import reviewDiffService from "@/services/review-diff-service.js";
import selectReviewersService from "@/services/select-reviewers-service.js";
import { RunStore } from "@/stores/run-store.js";
import diffHeadlineView from "@/views/diff-headline-view.js";
import diffReportView from "@/views/diff-report-view.js";
import epochBoundaryView from "@/views/epoch-boundary-view.js";
import evalHeadlineView from "@/views/eval-headline-view.js";
import runProgressView from "@/views/run-progress-view.js";
import runReportView from "@/views/run-report-view.js";

/**
 * What `praxis eval ci` does: verify, and leave no trace (12).
 *
 * CI re-derives verdicts — identical content hashes mean cache hits —
 * sets the exit code, and commits nothing: no ledger records, and the
 * cache in read-only mode so a miss never writes back. The branch's own
 * locally produced runs are the durable evidence; CI is the gate.
 *
 * Two gates share the machinery: the default full corpus verify, and
 * `--diff [base]` — the same merge-base evaluation `eval run --diff`
 * measures, judged on what the branch introduced.
 */
export const ciRunOrchestrator: Orchestrator<CiRunOptions> = async (
  ctx,
  { strict = false, diff = false },
) => {
  const cfg = ctx.config;

  const evalView = evalHeadlineView({ ci: true });
  ctx.render(evalView);

  // Announce any epoch boundary before reviewing (02): warn, never block.
  const reviewers = selectReviewersService(cfg, {});
  const boundaries = detectEpochBoundariesService(cfg, { reviewers });
  const boundaryView = epochBoundaryView(boundaries);

  ctx.render(boundaryView);

  // The progress event is emitted when a target is reviewed, and the
  // verdict is available. It is emitted for every target, so the view
  // can be updated in real time.
  const onProgress = (event: EvalProgress) => {
    const progressView = runProgressView(event);
    ctx.render(progressView);
  };

  if (diff) {
    const resolved = resolveDiffService(cfg, {
      base: typeof diff === "string" ? diff : undefined,
    });

    const headlineView = diffHeadlineView(resolved);
    ctx.render(headlineView);

    renderEvidenceGap(ctx, cfg);

    if (resolved.targets.length === 0) {
      ctx.render([{ channel: "content", entries: ["No spec-covered files changed."] }]);

      return "ok";
    }

    const run = await reviewDiffService(cfg, {
      reviewers,
      diff: resolved,
      ledger: false,
      readOnlyCache: true,
      onProgress,
    });

    const reportView = diffReportView(run);
    ctx.render(reportView);

    const introduced = strict ? run.summary.introduced : run.summary.errorsIntroduced;

    return introduced + run.summary.unverified === 0 ? "ok" : "failed";
  }

  const run = await reviewAllService(cfg, {
    reviewers,
    // CI verifies without writing (12): the branch's own runs are the evidence.
    ledger: false,
    readOnlyCache: true,
    onProgress,
  });

  const reportView = runReportView({ run, cached: true });
  ctx.render(reportView);

  const { errors, warnings, unverified } = run.summary;

  // Unverified fails CI outright: a gate that could not look is not a gate.
  const errorCount = errors + unverified + (strict ? warnings : 0);

  return errorCount === 0 ? "ok" : "failed";
};

export default prepareOrchestrator(ciRunOrchestrator);

/**
 * The evidence-gap notice (12, open Q1 resolved as a warning): a PR
 * whose branch carries no local diff-run has cache-verified enforcement
 * but no durable flow evidence — say so, never fail on it.
 */
function renderEvidenceGap(ctx: CommandContext, cfg: PraxisConfig): void {
  const { branch } = gitFacts(cfg.root);

  if (branch === null) return;

  const hasLocalDiffRun = new RunStore(cfg)
    .runs()
    .some((run) => run.scope === "diff" && run.branch === branch);

  if (hasLocalDiffRun) return;

  ctx.render([
    {
      channel: "warning",
      text: `No local diff-run in this branch's ledger — CI verifies the verdicts, but the flow evidence gap remains until someone runs \`praxis eval run --diff\` on the branch.`,
    },
  ]);
}
