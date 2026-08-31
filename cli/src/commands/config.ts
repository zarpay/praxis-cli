import type { Command } from "commander";

import chalk from "chalk";
import { spawnSync } from "node:child_process";

import { readJson } from "@/core/files.js";
import { Display, Logger } from "@/core/logger.js";
import { Paths } from "@/core/paths.js";

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
    .action(() => {
      const logger = new Logger();
      try {
        makeCommand().show();
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  config
    .command("edit")
    .description("Open the configuration in your default editor")
    .action(() => {
      const logger = new Logger();
      try {
        makeCommand().edit();
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
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
export class ConfigCommand {
  private readonly out = new Display();
  private readonly configPath: string;

  constructor({ configPath }: { configPath: string }) {
    this.configPath = configPath;
  }

  /** Prints the config file to stdout as formatted JSON with a header. */
  show(): void {
    const parsed = readJson(this.configPath);

    this.out.lines([
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
