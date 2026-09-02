import type { CommandRegistrar } from "@/types.js";

import { prepareAction } from "@/commands/action.js";
import compileProject from "@/domains/spec/orchestrators/compile-project.js";

const orchestrator = prepareAction(compileProject);

/**
 * Registers the `praxis compile` command.
 *
 * Compiles expert definitions into agent profiles and runs any enabled
 * plugins, per .praxis/config.json.
 */
const command: CommandRegistrar = (program) => {
  program
    .command("compile")
    .description("Compile expert definitions into agent files")
    .option("--alias <name>", "compile a specific agent by alias")
    .option("--watch", "watch source directories for changes and recompile")
    .action(orchestrator);
};

export default command;
