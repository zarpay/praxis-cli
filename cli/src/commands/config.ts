import type { CommandRegistrar } from "@/types.js";

import { prepareAction } from "@/commands/action.js";
import editConfig from "@/domains/workspace/orchestrators/edit-config.js";
import showConfig from "@/domains/workspace/orchestrators/show-config.js";

// One prepared orchestrator per subcommand, named for the subcommand.
const show = prepareAction(showConfig);
const edit = prepareAction(editConfig);

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
    .action(show);

  config
    .command("edit")
    .description("Open the project configuration in $VISUAL, $EDITOR, or vi")
    .action(edit);
};

export default command;
