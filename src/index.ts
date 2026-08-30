import { Command } from "commander";

import pkg from "../package.json";

import { registerAddCommand } from "@/commands/add.js";
import { registerCompileCommand } from "@/commands/compile.js";
import { registerConfigCommand } from "@/commands/config.js";
import { registerInitCommand } from "@/commands/init.js";
import { registerStatusCommand } from "@/commands/status.js";
import { registerValidateCommand } from "@/commands/validate.js";

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
  registerValidateCommand(program);
  registerAddCommand(program);
  registerStatusCommand(program);
  registerConfigCommand(program);

  return program;
}

const program = createProgram();
program.parse();
