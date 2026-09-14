import type { CommandRegistrar } from "@framework/types.js";

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
    .addHelpText(
      "after",
      `
When to use: you are writing a file and want the reviewers' opinion now.
The run is recorded in the ledger with its cost, exactly like any other,
but its critiques never enter triage or curate and never reach a report —
they describe code in flight, not code that landed. Use \`praxis eval run\`
when you mean the critiques as evidence.

It also never writes the verdict cache, so a later \`eval run\` on the same
content still calls the reviewer and records what it finds.

The target resolves to whatever the specs govern: a file, a directory, or —
when a spec uses \`cohort: by_directory\` — the whole cohort a named file
belongs to. Always exits 0; this is advice, not a gate.

Examples:
  $ praxis feedback src/services/checkout.ts
  $ praxis feedback src/services --reviewer flash
`,
    )
    .action(giveFeedbackOrchestrator);
};

export default feedbackCommand;
