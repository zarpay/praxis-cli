import type { CommandRegistrar } from "@framework/types.js";

import editConfigOrchestrator from "@/orchestrators/edit-config-orchestrator.js";
import showConfigOrchestrator from "@/orchestrators/show-config-orchestrator.js";

/**
 * Registers the `praxis config` command group.
 *
 * Shows the config file or opens it for editing.
 */
const configCommand: CommandRegistrar = (program) => {
  const config = program.command("config").description("View or edit the project configuration");

  config
    .command("show")
    .description("Print the project configuration as written, with its file path")
    .addHelpText(
      "after",
      `
When to use: to see the effective config and where it lives.

Example:
  $ praxis config show`,
    )
    .action(showConfigOrchestrator);

  config
    .command("edit")
    .description("Open the project configuration in $VISUAL, $EDITOR, or vi (human-only)")
    .addHelpText(
      "after",
      `
When to use: humans at a terminal only — it opens an interactive
editor. Agents and scripts edit .praxis/config.json directly.

Example:
  $ praxis config edit`,
    )
    .action(editConfigOrchestrator);
};

export default configCommand;
