import type { CommandRegistrar } from "@framework/types.js";

import { Command } from "commander";

/** Every help document ends by pointing at the site docs (09-l/m). */
export const DOCS_LINK = "Docs: https://zarpay.github.io/praxis-cli/";

/** One registered command's rendered help, as a terminal receives it. */
export interface RegisteredHelp {
  /** The dotted command path: "eval", "eval run". */
  path: string;
  /** The full --help output: built-in sections plus addHelpText. */
  help: string;
  /** True for an action-bearing leaf, false for a group. */
  leaf: boolean;
}

/**
 * Registers one command group into a throwaway program and renders the
 * full --help text of everything it declared — groups and leaves —
 * capturing built-in help and addHelpText output exactly the way a
 * user's terminal receives them.
 */
export function registeredHelps(register: CommandRegistrar): RegisteredHelp[] {
  const program = new Command();
  let captured = "";

  program.configureOutput({
    writeOut: (str: string) => {
      captured += str;
    },
  });
  register(program);

  const registered = collectCommands(program.commands, "");

  return registered.map(({ path, command }) => {
    captured = "";
    command.outputHelp();

    return { path, help: captured, leaf: command.commands.length === 0 };
  });
}

/** Depth-first listing of every command under (excluding) the root. */
function collectCommands(
  commands: readonly Command[],
  prefix: string,
): { path: string; command: Command }[] {
  return commands.flatMap((command) => {
    const path = prefix === "" ? command.name() : `${prefix} ${command.name()}`;
    const children = collectCommands(command.commands, path);

    return [{ path, command }, ...children];
  });
}
