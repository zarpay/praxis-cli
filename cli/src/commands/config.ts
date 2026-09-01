import type { Command } from "commander";

import { runAction } from "@/commands/action.js";
import { readJson } from "@/core/files.js";
import { Paths } from "@/domains/workspace/models/project-paths.js";
import editConfig from "@/domains/workspace/orchestrators/edit-config.js";
import { configEntries } from "@/domains/workspace/views/config.js";
import { Display } from "@/views/display.js";

/**
 * Registers the `praxis config` command group.
 *
 * Shows the resolved config file or opens it for editing.
 */
export function registerConfigCommand(program: Command): void {
  const config = program.command("config").description("View or edit the project configuration");

  config
    .command("show")
    .description("Print the current configuration")
    .action(() =>
      runAction(() => {
        const configPath = new Paths().configFile;

        new Display().print(configEntries(configPath, readJson(configPath)));
      }),
    );

  config
    .command("edit")
    .description("Open the configuration in your default editor")
    .action(() => runAction(() => editConfig({ configPath: new Paths().configFile })));
}
