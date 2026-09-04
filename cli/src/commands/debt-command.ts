import type { CommandRegistrar } from "@framework/types.js";

import reportDebtOrchestrator from "@/orchestrators/report-debt-orchestrator.js";

/**
 * Registers the `praxis debt` command group.
 *
 * Debt is nonconformance in code that predates its spec (01): a backlog
 * to burn down, honestly named, never chartable as agent performance.
 */
const debtCommand: CommandRegistrar = (program) => {
  const debtCmd = program
    .command("debt")
    .description("Pre-spec debt: the baseline, its paydown, and where it concentrates");

  debtCmd
    .command("report")
    .description("Debt stock and corpus paydown per axiom, concentration, re-baseline deltas")
    .option("--json", "machine-readable output (stable contract)")
    .addHelpText(
      "after",
      `
When to use: to run a debt program — baseline → current stock per
axiom, paydown credited by git author, concentration by directory.
Pure read: never calls a reviewer.

Example:
  $ praxis debt report
      AX-b951db [v32] baseline 3 → current 1 · paid down 2 · appeared 0`,
    )
    .action(reportDebtOrchestrator);
};

export default debtCommand;
