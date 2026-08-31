import { Command } from "commander";

import { registerAddCommand } from "@/commands/add.js";
import { registerCompileCommand } from "@/commands/compile.js";
import { registerConfigCommand } from "@/commands/config.js";
import { registerEvalCommand } from "@/commands/eval.js";
import { registerInitCommand } from "@/commands/init.js";
import { registerStatusCommand } from "@/commands/status.js";

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
  registerAddCommand(program);
  registerStatusCommand(program);
  registerConfigCommand(program);

  return program;
}

const program = createProgram();
program.parse();
