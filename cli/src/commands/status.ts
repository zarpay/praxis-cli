import type { Command } from "commander";

import { runAction } from "@/commands/action.js";
import analyzeProject from "@/domains/workspace/orchestrators/analyze-project.js";

/**
 * Registers the `praxis status` command.
 *
 * Reports document counts, review state, and structural issues. Exits 1
 * when any structural issue is found, so CI fails on a project whose
 * taxonomy has drifted.
 */
export default function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show project health dashboard")
    .action(() => runAction((ctx) => analyzeProject(ctx)));
}
