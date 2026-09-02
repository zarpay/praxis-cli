import type { CommandRegistrar } from "@/framework/types.js";

import compileProjectOrchestrator from "@/spec/orchestrators/compile-project-orchestrator.js";

/**
 * Registers the `praxis compile` command.
 *
 * Compiles expert definitions into agent profiles and runs any enabled
 * plugins, per .praxis/config.json.
 */
const compileCommand: CommandRegistrar = (program) => {
  program
    .command("compile")
    .description("Compile expert definitions into agent files")
    .option("--alias <name>", "compile a specific agent by alias")
    .option("--watch", "watch source directories for changes and recompile")
    .action(compileProjectOrchestrator);
};

export default compileCommand;
