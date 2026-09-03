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
    .option("--json", "machine-readable output (stable contract)", false)
    .action(reportDebtOrchestrator);
};

export default debtCommand;
