import type { CommandRegistrar } from "@framework/types.js";

import configEditHelp from "@/help/config-edit-help.md";
import configHelp from "@/help/config-help.md";
import configShowHelp from "@/help/config-show-help.md";
import editConfigOrchestrator from "@/orchestrators/edit-config-orchestrator.js";
import showConfigOrchestrator from "@/orchestrators/show-config-orchestrator.js";

/**
 * Registers the `praxis config` command group.
 *
 * Shows the config file or opens it for editing.
 */
const configCommand: CommandRegistrar = (program) => {
  const config = program
    .command("config")
    .description("View or edit the project configuration")
    .addHelpText("after", `\n${configHelp}`);

  config
    .command("show")
    .description("Print the project configuration as written, with its file path")
    .addHelpText("after", `\n${configShowHelp}`)
    .action(showConfigOrchestrator);

  config
    .command("edit")
    .description("Open the project configuration in $VISUAL, $EDITOR, or vi (human-only)")
    .addHelpText("after", `\n${configEditHelp}`)
    .action(editConfigOrchestrator);
};

export default configCommand;
