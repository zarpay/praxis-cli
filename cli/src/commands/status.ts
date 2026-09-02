import type { CommandRegistrar } from "@/types.js";

import { handle } from "@/commands/action.js";
import analyzeProject from "@/domains/workspace/orchestrators/analyze-project.js";

/**
 * Registers the `praxis status` command.
 *
 * Reports document counts, review state, and structural issues. Exits 1
 * when any structural issue is found, so CI fails on a project whose
 * taxonomy has drifted.
 */
const command: CommandRegistrar = (program) => {
  program
    .command("status")
    .description("Show project health dashboard")
    .action(handle(analyzeProject));
};

export default command;
