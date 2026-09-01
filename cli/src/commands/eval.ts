import type { Command } from "commander";

import type { AllOptions } from "@/domains/workspace/types.js";

import { runAction } from "@/commands/action.js";
import { joinPath } from "@/core/paths.js";
import reportVerdicts from "@/domains/eval/orchestrators/report-verdicts.js";
import reviewTargets from "@/domains/eval/orchestrators/review-targets.js";
import runEval from "@/domains/eval/orchestrators/run-eval.js";
import selectReviewers from "@/domains/eval/services/select-reviewers.js";
import {
  progressEntries,
  reviewedTargetEntries,
  runHeadline,
  targetsHeadline,
  runReportLines,
  verdictReportsLines,
} from "@/domains/eval/views/summary.js";
import { PraxisConfig } from "@/domains/workspace/models/praxis-config.js";
import { Paths } from "@/domains/workspace/models/project-paths.js";
import { Display } from "@/views/display.js";
import { renderReport } from "@/views/report.js";

/**
 * Registers the `praxis eval` command group.
 *
 * Subcommands for reviewing targets against their specs. Family rule:
 * `eval run` writes (invokes reviewers); every other subcommand reads
 * existing results.
 */
export function registerEvalCommand(program: Command): void {
  const evalCmd = program.command("eval").description("Review targets against their specs");

  evalCmd
    .command("run [targets...]")
    .description("Review targets against their specs (no targets = full run)")
    .option("--type <type>", "only review targets of this type (full run only)")
    .option("--reviewer <name>", "run only the named reviewer (default: all configured reviewers)")
    .option("--spec <path>", "path to spec file (single target only)")
    .option("--verbose", "show full AI reasoning", false)
    .option("--fail-fast", "stop on first error (full run only)", false)
    .option("--no-cache", "disable the verdict cache")
    .action((targets: string[], options: AllOptions & { spec?: string }) =>
      runAction(async () => {
        const { errors } =
          targets.length === 0 ? await fullRun(options) : await namedRun(targets, options);

        return errors === 0 ? 0 : 1;
      }),
    );

  evalCmd
    .command("ci")
    .description("Run a full review in CI mode")
    .option("--strict", "fail on warnings too", false)
    .action((options: { strict: boolean }) =>
      runAction(async () => {
        const summary = await fullRun({ verbose: false, failFast: false, cache: true }, true);
        const failures = summary.errors + (options.strict ? summary.warnings : 0);

        return failures === 0 ? 0 : 1;
      }),
    );

  evalCmd
    .command("verdict <target>")
    .description("Show the cached verdict for a target, without an API call")
    .option("--verbose", "show full AI reasoning", false)
    .action((target: string, options: { verbose: boolean }) =>
      runAction(() => {
        const { root, config } = project();
        const { reports, named } = reportVerdicts({ targetPath: target, root, config });

        renderReport(verdictReportsLines(reports, { named, verbose: options.verbose }));
      }),
    );
}

/** The project this invocation runs against. */
function project(): { root: string; config: PraxisConfig } {
  const root = new Paths().root;

  return { root, config: new PraxisConfig(root) };
}

/** Reviews every spec-covered target, rendering progress as it goes. */
async function fullRun(options: AllOptions, ci = false) {
  const out = new Display();
  const { root, config } = project();

  out.line(runHeadline({ ci, type: options.type }));

  const run = await runEval({
    root,
    sources: config.sources,
    specFilePattern: config.specFilePattern,
    absoluteIgnore: config.ignore.map((pattern) => joinPath(root, pattern)),
    reviewers: selectReviewers({ configured: config.reviewers, only: options.reviewer }),
    type: options.type,
    failFast: options.failFast,
    useCache: options.cache,
    onProgress: (event) => out.print(progressEntries(event)),
  });

  renderReport(runReportLines(run, { cached: options.cache }), { out });

  return run.summary;
}

/** Reviews the named targets, rendering each verdict as it lands. */
async function namedRun(targets: string[], options: AllOptions & { spec?: string }) {
  const out = new Display();
  const { root, config } = project();

  out.line(targetsHeadline(targets));

  return reviewTargets({
    targets,
    root,
    config,
    spec: options.spec,
    reviewer: options.reviewer,
    useCache: options.cache,
    onVerdict: (event) => out.print(reviewedTargetEntries({ ...event, verbose: options.verbose })),
  });
}
