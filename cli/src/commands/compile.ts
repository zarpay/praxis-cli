import type { Command } from "commander";

import { runAction } from "@/commands/action.js";
import compileProject from "@/domains/spec/orchestrators/compile-project.js";

/**
 * Registers the `praxis compile` command.
 *
 * Compiles expert definitions into agent profiles and runs any enabled
 * plugins, per .praxis/config.json.
 */
export default function registerCompileCommand(program: Command): void {
  program
    .command("compile")
    .description("Compile expert definitions into agent files")
    .option("--alias <name>", "compile a specific agent by alias")
    .option("--watch", "watch source directories for changes and recompile")
    .action((options: { alias?: string; watch?: boolean }) =>
      runAction((ctx) => compileProject(ctx, options)),
    );
}
