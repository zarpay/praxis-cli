import type { CommandRegistrar } from "@framework/types.js";

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
    .addHelpText(
      "after",
      `
When to use: a health check — document counts, per-reviewer review
state, structural issues. Exits 1 when the taxonomy has drifted, so it
doubles as a cheap CI step. --json is an agent's situational poll.

Example:
  $ praxis status --json | jq .evalState.pending_triage`,
    )
    .action(analyzeProjectOrchestrator);
};

export default statusCommand;
