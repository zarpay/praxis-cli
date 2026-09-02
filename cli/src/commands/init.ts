import type { CommandRegistrar } from "@/types.js";

import { runAction } from "@/commands/action.js";
import initProject from "@/domains/workspace/orchestrators/init-project.js";

/**
 * Registers the `praxis init` command.
 *
 * Scaffolds a new Praxis project: the minimal `.praxis/` tree by
 * default, and the spec-layer authoring taxonomy on request.
 */
const registerInitCommand: CommandRegistrar = (program) => {
  program
    .command("init")
    .description("Initialize a new Praxis project")
    .argument("[directory]", "target directory (defaults to current directory)", ".")
    .option(
      "--spec-layer",
      "also scaffold the spec-layer authoring tree (experts, practices, context)",
      false,
    )
    .action((directory: string, options: { specLayer: boolean }) =>
      runAction((ctx) => initProject(ctx, { directory, specLayer: options.specLayer })),
    );
};

export default registerInitCommand;
