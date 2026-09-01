import type { Command } from "commander";

import chalk from "chalk";
import { spawnSync } from "node:child_process";

import { runAction } from "@/commands/action.js";
import { PraxisBase } from "@/core/base.js";
import { readJson } from "@/core/files.js";
import { Paths } from "@/domains/workspace/models/project-paths.js";

/** Horizontal rule used in the config header output. */
const DIVIDER = chalk.cyan("─".repeat(42));

/**
 * Registers the `praxis config` command group.
 *
 * Provides subcommands for viewing (`show`) and editing (`edit`)
 * the project's .praxis/config.json.
 */
export function registerConfigCommand(program: Command): void {
  const config = program.command("config").description("View or edit the project configuration");

  config
    .command("show")
    .description("Print the current configuration")
    .action(() => runAction(() => makeCommand().show()));

  config
    .command("edit")
    .description("Open the configuration in your default editor")
    .action(() => runAction(() => makeCommand().edit()));
}

/** Builds a ConfigCommand for the current project's config file. */
function makeCommand(): ConfigCommand {
  return new ConfigCommand({ configPath: new Paths().configFile });
}

/**
 * Views and edits a Praxis config file.
 *
 * Bound to one config file path at construction; show() prints it,
 * edit() opens it in the user's preferred editor.
 */
export class ConfigCommand extends PraxisBase {
  private readonly configPath: string;

  constructor({ configPath }: { configPath: string }) {
    super();
    this.configPath = configPath;
  }

  /** Prints the config file to stdout as formatted JSON with a header. */
  show(): void {
    const parsed = readJson(this.configPath);

    this.out.print([
      "",
      "  " + chalk.bold("Praxis Config"),
      "  " + DIVIDER,
      "  " + chalk.dim(this.configPath),
      "",
      JSON.stringify(parsed, null, 2),
      "",
    ]);
  }

  /**
   * Opens the config file in the user's preferred editor.
   *
   * Checks VISUAL, then EDITOR, then falls back to vi.
   *
   * @throws The spawn error if the editor could not be started
   */
  edit(): void {
    const editor = process.env["VISUAL"] ?? process.env["EDITOR"] ?? "vi";
    const result = spawnSync(editor, [this.configPath], { stdio: "inherit" });

    if (result.error) {
      throw result.error;
    }
  }
}
