import type { CommandRegistrar } from "@framework/types.js";

import debtHelp from "@/help/debt-help.md";
import debtReportHelp from "@/help/debt-report-help.md";
import reportDebtOrchestrator from "@/orchestrators/report-debt-orchestrator.js";

/**
 * Registers the `praxis debt` command group.
 *
 * Debt is nonconformance in code that predates its spec: a backlog
 * to burn down, honestly named, never chartable as agent performance.
 */
const debtCommand: CommandRegistrar = (program) => {
  const debtCmd = program
    .command("debt")
    .description("Pre-spec debt: the baseline, its paydown, and where it concentrates")
    .addHelpText("after", `\n${debtHelp}`);

  debtCmd
    .command("report")
    .description("Debt stock and corpus paydown per axiom, concentration, re-baseline deltas")
    .option("--json", "machine-readable output (stable contract)")
    .addHelpText("after", `\n${debtReportHelp}`)
    .action(reportDebtOrchestrator);
};

export default debtCommand;
