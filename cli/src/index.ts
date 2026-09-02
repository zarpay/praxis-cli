import { Command } from "commander";

import registerAddCommand from "@/commands/add-command.js";
import registerAxiomsCommand from "@/commands/axioms-command.js";
import registerCompileCommand from "@/commands/compile-command.js";
import registerConfigCommand from "@/commands/config-command.js";
import registerEvalCommand from "@/commands/eval-command.js";
import registerInitCommand from "@/commands/init-command.js";
import registerStatusCommand from "@/commands/status-command.js";

import pkg from "../package.json";

/** CLI version, sourced from package.json and inlined at build time. */
const VERSION = pkg.version;

/**
 * Creates and configures the root CLI program.
 *
 * Wires all subcommands (init, compile, validate) and
 * provides top-level --version / --help flags.
 */
function createProgram(): Command {
  const program = new Command();

  program.name("praxis").description("CLI for the Praxis knowledge framework").version(VERSION);

  registerInitCommand(program);
  registerCompileCommand(program);
  registerEvalCommand(program);
  registerAxiomsCommand(program);
  registerAddCommand(program);
  registerStatusCommand(program);
  registerConfigCommand(program);

  return program;
}

createProgram().parse();
