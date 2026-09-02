import type { CommandRegistrar } from "@/types.js";

import editConfig from "@/domains/workspace/orchestrators/edit-config.js";
import showConfig from "@/domains/workspace/orchestrators/show-config.js";

/**
 * Registers the `praxis config` command group.
 *
 * Shows the config file or opens it for editing.
 */
const command: CommandRegistrar = (program) => {
  const config = program.command("config").description("View or edit the project configuration");

  config
    .command("show")
    .description("Print the project configuration as written, with its file path")
    .action(showConfig);

  config
    .command("edit")
    .description("Open the project configuration in $VISUAL, $EDITOR, or vi")
    .action(editConfig);
};

export default command;
