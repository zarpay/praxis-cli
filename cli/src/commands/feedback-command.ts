import type { CommandRegistrar } from "@framework/types.js";

import feedbackHelp from "@/help/feedback-help.md";
import giveFeedbackOrchestrator from "@/orchestrators/give-feedback-orchestrator.js";

/**
 * Registers `praxis feedback` — review for the person writing the code.
 *
 * A top-level verb rather than an `eval` subcommand, because the `eval`
 * family has one rule (`eval run` writes, everything else reads) and a
 * second reviewer-invoking subcommand would blur it. The name is also
 * what a developer would look for.
 */
const feedbackCommand: CommandRegistrar = (program) => {
  program
    .command("feedback <target>")
    .description("Review a file or directory for immediate feedback — never queued for triage")
    .option("--reviewer <name>", "run only the named reviewer (default: all configured reviewers)")
    .option("--verbose", "show full AI reasoning", false)
    .option("--no-cache", "disable the verdict cache")
    .option("--json", "machine-readable outcome on stdout")
    .addHelpText("after", `\n${feedbackHelp}`)
    .action(giveFeedbackOrchestrator);
};

export default feedbackCommand;
