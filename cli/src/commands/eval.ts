import type { RunEvalOptions } from "@/domains/eval/types.js";
import type { CommandRegistrar } from "@/types.js";

import { runAction } from "@/commands/action.js";
import reportVerdicts from "@/domains/eval/orchestrators/report-verdicts.js";
import runEval from "@/domains/eval/orchestrators/run-eval.js";

/**
 * Registers the `praxis eval` command group.
 *
 * `eval run` writes (invokes reviewers); every other subcommand reads
 * existing results.
 */
const registerEvalCommand: CommandRegistrar = (program) => {
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
    .action((targets: string[], options: RunEvalOptions) =>
      runAction((ctx) => runEval(ctx, { ...options, targets })),
    );

  evalCmd
    .command("ci")
    .description("Run a full review in CI mode")
    .option("--strict", "fail on warnings too", false)
    .action((options: { strict: boolean }) =>
      runAction((ctx) => runEval(ctx, { ci: true, strict: options.strict })),
    );

  evalCmd
    .command("verdict <target>")
    .description("Show the cached verdict for a target, without an API call")
    .option("--verbose", "show full AI reasoning", false)
    .action((target: string, options: { verbose: boolean }) =>
      runAction((ctx) => reportVerdicts(ctx, { target, verbose: options.verbose })),
    );
};

export default registerEvalCommand;
