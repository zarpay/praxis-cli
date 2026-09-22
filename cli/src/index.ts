import { Command, CommanderError } from "commander";

import registerAddCommand from "@/commands/add-command.js";
import registerAxiomsCommand from "@/commands/axioms-command.js";
import registerCompileCommand from "@/commands/compile-command.js";
import registerConfigCommand from "@/commands/config-command.js";
import registerDebtCommand from "@/commands/debt-command.js";
import registerEvalCommand from "@/commands/eval-command.js";
import registerFeedbackCommand from "@/commands/feedback-command.js";
import registerInitCommand from "@/commands/init-command.js";
import registerStatusCommand from "@/commands/status-command.js";
import praxisHelp from "@/help/praxis-help.md";
import orientProjectOrchestrator from "@/orchestrators/orient-project-orchestrator.js";
import { CLI_VERSION } from "@/version.js";

/**
 * Creates and configures the root CLI program.
 *
 * Wires every command group — init, compile, eval, axioms, debt, add,
 * status, config — and provides the top-level --version / --help flags.
 * Bare `praxis` is a command too: the orientation screen.
 */
function createProgram(): Command {
  const program = new Command();

  program.name("praxis").description("CLI for the Praxis knowledge framework").version(CLI_VERSION);

  // Commander throws instead of exiting, so usage mistakes get exit
  // code 2. Set before the subcommands register — they copy the
  // override at creation time.
  program.exitOverride();
  program.showHelpAfterError("(run the command with --help for usage)");

  // Help is API documentation (09-l/m): the top level names the
  // workflows and the exit-code contract, not just the commands. The
  // long-form text lives in src/help/, one document per help moment.
  program.addHelpText("after", `\n${praxisHelp}`);

  // Bare `praxis` is the orientation screen — counts and
  // staleness at a glance, each line naming its command; --json is an
  // agent's cheapest situational poll. The root may consume a
  // --json meant for a subcommand (commander parses known options
  // non-positionally); the composition root reads optsWithGlobals(), so
  // it reaches the right orchestrator either way.
  program.option("--json", "machine-readable orientation (stable contract)", false);
  program.action(orientProjectOrchestrator);

  registerInitCommand(program);
  registerCompileCommand(program);
  registerEvalCommand(program);
  registerFeedbackCommand(program);
  registerAxiomsCommand(program);
  registerDebtCommand(program);
  registerAddCommand(program);
  registerStatusCommand(program);
  registerConfigCommand(program);

  return program;
}

try {
  createProgram().parse();
} catch (err) {
  // Commander already printed its message (the usage error, or the
  // help/version text); only the exit code is ours — 0 when commander
  // exited cleanly (help, version), 2 for a usage mistake.
  const clean = err instanceof CommanderError && err.exitCode === 0;

  process.exit(clean ? 0 : 2);
}
