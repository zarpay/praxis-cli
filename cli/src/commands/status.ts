import type { Command } from "commander";

import type { StatusReport } from "@/domains/workspace/types.js";

import { runAction } from "@/commands/action.js";
import { PraxisBase } from "@/core/base.js";
import { PraxisConfig } from "@/core/config.js";
import { Paths } from "@/core/paths.js";
import analyzeProject, { hasIssues } from "@/domains/workspace/orchestrators/analyze-project.js";
import { countLines, issueBlocks, validationBlocks } from "@/domains/workspace/views/status.js";

/**
 * Registers the `praxis status` command.
 *
 * Reports document counts, validation state, and structural issues.
 * Exits 1 when any structural issue is found.
 */
export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show project health dashboard")
    .action(() =>
      runAction(async () => {
        const root = new Paths().root;
        const report = await analyzeProject({ root, config: new PraxisConfig(root) });

        new StatusDisplay().render(report);

        if (hasIssues(report)) {
          process.exitCode = 1;
        }
      }),
    );
}

/**
 * Renders a health report for the terminal.
 *
 * Every decision about *what* to show lives in the workspace domain's
 * view functions; this only prints what they return.
 */
export class StatusDisplay extends PraxisBase {
  /** Prints the report: eval state always, framework health when the compiler is in use. */
  render(report: StatusReport): void {
    this.logger.info("Praxis Project Status");

    if (report.compilerInUse) {
      this.out.print(["", ...countLines(report.counts)]);
    }

    for (const { judge, badges } of validationBlocks(report.validation)) {
      this.out.line();
      this.logger.info(`Validation (judge: ${judge})`);
      this.out.print(badges);
    }

    if (!report.compilerInUse) return;

    const blocks = issueBlocks(report);

    for (const { heading, items } of blocks) {
      this.out.line();
      this.logger.warn(heading);
      this.out.print(items.map((item) => `  ${item}`));
    }

    const issueCount = blocks.reduce((total, block) => total + block.items.length, 0);

    this.out.line();

    if (issueCount === 0) {
      this.logger.success("No issues found");
    } else {
      this.logger.info(`${issueCount} issue(s) found`);
    }
  }
}
