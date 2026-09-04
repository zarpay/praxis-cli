import type { CommandRegistrar } from "@framework/types.js";

import compileProjectOrchestrator from "@/orchestrators/compile-project-orchestrator.js";

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
    .addHelpText(
      "after",
      `
When to use: after editing experts or practices. Each expert compiles
to a profile opening with eval-targeting frontmatter (paths, excludes,
exemplars) — the profile is also a spec — and enabled plugins emit
their own output (e.g. Claude Code agents). Offline; no API calls.

Example:
  $ praxis compile
      Compiled 3 agent(s)`,
    )
    .action(compileProjectOrchestrator);
};

export default compileCommand;
