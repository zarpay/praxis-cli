import type { CommandRegistrar } from "@framework/types.js";

import initProjectOrchestrator from "@/orchestrators/init-project-orchestrator.js";

/**
 * Registers the `praxis init` command.
 *
 * Scaffolds a new Praxis project: the minimal `.praxis/` tree by
 * default, and the spec-layer authoring taxonomy on request.
 */
const initCommand: CommandRegistrar = (program) => {
  program
    .command("init")
    .description("Initialize a new Praxis project")
    .argument("[directory]", "target directory (defaults to current directory)", ".")
    .option(
      "--spec-layer",
      "also scaffold the spec-layer authoring tree (experts, practices, context)",
      false,
    )
    .action(initProjectOrchestrator);
};

export default initCommand;
