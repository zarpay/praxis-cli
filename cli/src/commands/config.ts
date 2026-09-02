import type { CommandRegistrar } from "@/types.js";

import { runAction } from "@/commands/action.js";
import editConfig from "@/domains/workspace/orchestrators/edit-config.js";
import showConfig from "@/domains/workspace/orchestrators/show-config.js";

/**
 * Registers the `praxis config` command group.
 *
 * Shows the config file or opens it for editing.
 */
const registerConfigCommand: CommandRegistrar = (program) => {
  const config = program.command("config").description("View or edit the project configuration");

  config
    .command("show")
    .description("Print the current configuration")
    .action(() => runAction((ctx) => showConfig(ctx, {})));

  config
    .command("edit")
    .description("Open the configuration in your default editor")
    .action(() => runAction((ctx) => editConfig(ctx, {})));
};

export default registerConfigCommand;
