import type { CommandRegistrar } from "@framework/types.js";

import statusHelp from "@/help/status-help.md";
import analyzeProjectOrchestrator from "@/orchestrators/analyze-project-orchestrator.js";

/**
 * Registers the `praxis status` command.
 *
 * Reports document counts, review state, and structural issues. Exits 1
 * when any structural issue is found, so CI fails on a project whose
 * taxonomy has drifted.
 */
const statusCommand: CommandRegistrar = (program) => {
  program
    .command("status")
    .description("Show project health and review coverage")
    .option("--json", "machine-readable output (stable contract)")
    .addHelpText("after", `\n${statusHelp}`)
    .action(analyzeProjectOrchestrator);
};

export default statusCommand;
