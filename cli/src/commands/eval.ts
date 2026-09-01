import type { Command } from "commander";

import type { EvalProgress } from "@/domains/eval/types.js";
import type { AllOptions } from "@/domains/workspace/types.js";

import chalk from "chalk";

import { runAction } from "@/commands/action.js";
import { joinPath } from "@/core/paths.js";
import reportVerdicts from "@/domains/eval/orchestrators/report-verdicts.js";
import reviewTargets from "@/domains/eval/orchestrators/review-targets.js";
import runEval from "@/domains/eval/orchestrators/run-eval.js";
import selectReviewers from "@/domains/eval/services/select-reviewers.js";
import { unitHeading, verdictMark } from "@/domains/eval/views/progress.js";
import { summaryEntries, verdictEntries } from "@/domains/eval/views/summary.js";
import { VerdictReporter } from "@/domains/eval/views/verdict-report.js";
import { PraxisConfig } from "@/domains/workspace/models/praxis-config.js";
import { Paths } from "@/domains/workspace/models/project-paths.js";
import { Display } from "@/views/display.js";

/**
 * Registers the `praxis eval` command group.
 *
 * Subcommands for reviewing targets against their specs. Family rule:
 * `eval run` writes (invokes reviewers); every other subcommand reads
 * existing results. Everything here parses arguments, calls one
 * orchestrator, renders what it returns, and maps it to an exit code.
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
        const summary = await fullRun({ verbose: false, failFast: false, cache: true }, "ci");
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
        const out = new Display();
        const { root, config } = project();
        const result = reportVerdicts({ targetPath: target, root, config });
        const reporter = new VerdictReporter({ specFilePattern: config.specFilePattern, root });

        for (const { reviewer, report } of result.reports) {
          if (result.named) {
            out.print(["", { text: `Reviewer: ${reviewer}`, color: "cyan" }]);
          }

          reporter.render(report, options.verbose);
        }
      }),
    );
}

/** The project this invocation runs against. */
function project(): { root: string; config: PraxisConfig } {
  const root = new Paths().root;

  return { root, config: new PraxisConfig(root) };
}

/** What a full run announces before it starts. */
function headline(mode: "run" | "ci", type?: string): string {
  if (mode === "ci") return "Running CI review...";

  return type ? `Reviewing all ${type} documents...` : "Reviewing all documents...";
}

/** Reviews every spec-covered target, rendering progress as it goes. */
async function fullRun(options: AllOptions, mode: "run" | "ci" = "run") {
  const out = new Display();
  const { root, config } = project();
  const reviewers = selectReviewers({ configured: config.reviewers, only: options.reviewer });

  out.line(headline(mode, options.type));

  const run = await runEval({
    root,
    sources: config.sources,
    specFilePattern: config.specFilePattern,
    absoluteIgnore: config.ignore.map((pattern) => joinPath(root, pattern)),
    reviewers,
    type: options.type,
    failFast: options.failFast,
    useCache: options.cache,
    onProgress: (event) => renderProgress(out, event),
  });

  if (run.stoppedEarly) {
    out.print([
      "",
      { badge: "STOPPED", color: "yellow", value: "Review stopped early due to --fail-fast" },
    ]);
  }

  out.print(summaryEntries(run.summary));

  if (options.cache) {
    out.print([
      "",
      {
        badge: "CACHE",
        color: "blue",
        value: `Hits: ${run.cacheStats.hits}, Misses: ${run.cacheStats.misses}`,
      },
    ]);
  }

  return run.summary;
}

/** Reviews the named targets, rendering each verdict as it lands. */
async function namedRun(targets: string[], options: AllOptions & { spec?: string }) {
  const out = new Display();
  const { root, config } = project();

  out.line(`Reviewing ${targets.length === 1 ? targets[0] : `${targets.length} targets`}...`);

  return reviewTargets({
    targets,
    root,
    config,
    spec: options.spec,
    reviewer: options.reviewer,
    useCache: options.cache,
    onVerdict: ({ path, verdict, reviewerName }) => {
      const label = reviewerName ? `${path} ${chalk.cyan(`[reviewer: ${reviewerName}]`)}` : path;

      out.print(verdictEntries(label, verdict, options.verbose));
    },
  });
}

/** Renders one run event as it happens. */
function renderProgress(out: Display, event: EvalProgress): void {
  if (event.kind === "unit-start") {
    out.print(["", unitHeading(event)]);
  } else if (event.kind === "verdict") {
    out.print([
      `\t${verdictMark(event.verdict)}`,
      ...(event.verdict.compliant
        ? []
        : event.verdict.issues.map((issue) => `\t${chalk.dim("·")} ${issue}`)),
    ]);
  } else {
    out.print([`\t${chalk.red("✗ ERROR")}`, `\t${chalk.dim("·")} ${event.message}`]);
  }
}
