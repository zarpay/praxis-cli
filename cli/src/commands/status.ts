import type { Command } from "commander";

import { runAction } from "@/commands/action.js";
import { PraxisConfig } from "@/domains/workspace/models/praxis-config.js";
import { Paths } from "@/domains/workspace/models/project-paths.js";
import analyzeProject from "@/domains/workspace/orchestrators/analyze-project.js";
import countStatusIssues from "@/domains/workspace/services/count-status-issues.js";
import { countLines, issueBlocks, validationBlocks } from "@/domains/workspace/views/status.js";
import { Display } from "@/views/display.js";
import { Logger } from "@/views/logger.js";

/**
 * Registers the `praxis status` command.
 *
 * Reports document counts, review state, and structural issues. Exits 1
 * when any structural issue is found, so CI fails on a project whose
 * taxonomy has drifted.
 */
export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show project health dashboard")
    .action(() =>
      runAction(async () => {
        const root = new Paths().root;
        const report = await analyzeProject({ root, config: new PraxisConfig(root) });

        render(report);

        if (countStatusIssues(report) > 0) {
          process.exitCode = 1;
        }
      }),
    );
}

/**
 * Prints a health report.
 *
 * Every decision about *what* to show lives in the workspace domain's
 * view functions; this only prints what they return.
 */
function render(report: Awaited<ReturnType<typeof analyzeProject>>): void {
  const out = new Display();
  const logger = new Logger();

  logger.info("Praxis Project Status");

  if (report.compilerInUse) {
    out.print(["", ...countLines(report.counts)]);
  }

  for (const { reviewer, badges } of validationBlocks(report.validation)) {
    out.line();
    logger.info(`Validation (reviewer: ${reviewer})`);
    out.print(badges);
  }

  if (!report.compilerInUse) return;

  const blocks = issueBlocks(report);

  for (const { heading, items } of blocks) {
    out.line();
    logger.warn(heading);
    out.print(items.map((item) => `  ${item}`));
  }

  const issues = blocks.reduce((total, block) => total + block.items.length, 0);

  out.line();

  if (issues === 0) {
    logger.success("No issues found");
  } else {
    logger.info(`${issues} issue(s) found`);
  }
}
