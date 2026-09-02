import type { CommandRegistrar } from "@/types.js";

import analyzeProjectOrchestrator from "@/domains/workspace/orchestrators/analyze-project-orchestrator.js";

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
    .action(analyzeProjectOrchestrator);
};

export default statusCommand;
