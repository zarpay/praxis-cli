import type { Command } from "commander";

import { runAction } from "@/commands/action.js";
import { resolvePath } from "@/core/paths.js";
import { InitCommand } from "@/domains/workspace/orchestrators/init-project.js";

/**
 * Registers the `praxis init` command.
 *
 * Scaffolds a new Praxis project by copying core framework files and
 * plugin-specific files based on config into the target directory.
 */
export function registerInitCommand(program: Command): void {
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
      runAction(() =>
        new InitCommand({ targetDir: resolvePath(directory), specLayer: options.specLayer }).init(),
      ),
    );
}
