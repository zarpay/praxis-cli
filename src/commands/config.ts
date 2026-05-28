import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Command } from "commander";
import chalk from "chalk";

import { Logger } from "@/core/logger.js";
import { Paths } from "@/core/paths.js";

const DIVIDER = chalk.cyan("─".repeat(42));

/**
 * Prints the contents of a Praxis config file to stdout with a formatted header.
 *
 * @param configPath - Absolute path to the config.json file
 */
export function showConfig(configPath: string): void {
  const raw = readFileSync(configPath, "utf-8");
  const parsed = JSON.parse(raw) as unknown;

  console.log();
  console.log("  " + chalk.bold("Praxis Config"));
  console.log("  " + DIVIDER);
  console.log("  " + chalk.dim(configPath));
  console.log();
  console.log(JSON.stringify(parsed, null, 2));
  console.log();
}

/**
 * Opens a Praxis config file in the user's preferred editor.
 *
 * Checks VISUAL, then EDITOR, then falls back to vi.
 *
 * @param configPath - Absolute path to the config.json file
 */
export function editConfig(configPath: string): void {
  const editor = process.env["VISUAL"] ?? process.env["EDITOR"] ?? "vi";
  const result = spawnSync(editor, [configPath], { stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
}

export function registerConfigCommand(program: Command): void {
  const config = program.command("config").description("View or edit the project configuration");

  config
    .command("show")
    .description("Print the current configuration")
    .action(() => {
      const logger = new Logger();
      try {
        const paths = new Paths();
        showConfig(join(paths.root, ".praxis", "config.json"));
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
        const paths = new Paths();
        editConfig(join(paths.root, ".praxis", "config.json"));
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
