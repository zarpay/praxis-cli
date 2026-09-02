import type { DisplayEntry } from "@framework/types.js";

import chalk from "chalk";

/** Horizontal rule under the config header. */
const DIVIDER = "─".repeat(40);

/** The config file, printed with a header naming where it came from. */
export function configEntries(configPath: string, config: unknown): DisplayEntry[] {
  return [
    "",
    "  " + chalk.bold("Praxis Config"),
    "  " + DIVIDER,
    "  " + chalk.dim(configPath),
    "",
    JSON.stringify(config, null, 2),
    "",
  ];
}
