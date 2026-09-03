import { Command } from "commander";

import registerAddCommand from "@/commands/add-command.js";
import registerAxiomsCommand from "@/commands/axioms-command.js";
import registerCompileCommand from "@/commands/compile-command.js";
import registerConfigCommand from "@/commands/config-command.js";
import registerDebtCommand from "@/commands/debt-command.js";
import registerEvalCommand from "@/commands/eval-command.js";
import registerInitCommand from "@/commands/init-command.js";
import registerStatusCommand from "@/commands/status-command.js";
import orientProjectOrchestrator from "@/orchestrators/orient-project-orchestrator.js";

import pkg from "../package.json";

/** CLI version, sourced from package.json and inlined at build time. */
const VERSION = pkg.version;

/**
 * Creates and configures the root CLI program.
 *
 * Wires every command group — init, compile, eval, axioms, debt, add,
 * status, config — and provides the top-level --version / --help flags.
 * Bare `praxis` is a command too: the orientation screen.
 */
function createProgram(): Command {
  const program = new Command();

  program.name("praxis").description("CLI for the Praxis knowledge framework").version(VERSION);

  // Bare `praxis` is the orientation screen (09-h) — counts and
  // staleness at a glance, each line naming its command.
  program.action(orientProjectOrchestrator);

  registerInitCommand(program);
  registerCompileCommand(program);
  registerEvalCommand(program);
  registerAxiomsCommand(program);
  registerDebtCommand(program);
  registerAddCommand(program);
  registerStatusCommand(program);
  registerConfigCommand(program);

  return program;
}

createProgram().parse();
