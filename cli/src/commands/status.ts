import type { Command } from "commander";

import { runAction } from "@/commands/action.js";
import { PraxisConfig } from "@/domains/workspace/models/praxis-config.js";
import { Paths } from "@/domains/workspace/models/project-paths.js";
import analyzeProject from "@/domains/workspace/orchestrators/analyze-project.js";
import countStatusIssues from "@/domains/workspace/services/count-status-issues.js";
import { statusReport } from "@/domains/workspace/views/status.js";
import { renderReport } from "@/views/report.js";

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
    .action(() =>
      runAction(async () => {
        const root = new Paths().root;
        const report = await analyzeProject({ root, config: new PraxisConfig(root) });

        renderReport(statusReport(report));

        if (countStatusIssues(report) > 0) {
          process.exitCode = 1;
        }
      }),
    );
}
