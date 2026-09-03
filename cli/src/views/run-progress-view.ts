import type { EvalProgress, Verdict } from "@/types.js";
import type { View } from "@framework/types.js";

import chalk from "chalk";

import { baseName } from "@/helpers/paths-helper.js";

/**
 * One event of a running review, as it happens: the unit's heading, the
 * verdict mark, or the failure.
 */
const runProgressView: View<EvalProgress> = (event) => {
  if (event.kind === "unit-start") {
    return [{ channel: "content", entries: ["", unitHeading(event)] }];
  }

  if (event.kind === "verdict") {
    return [
      {
        channel: "content",
        entries: [
          `\t${verdictMark(event.verdict)}`,
          ...(event.verdict.compliant
            ? []
            : event.verdict.issues.map(
                (issue) => `\t${chalk.dim("·")} ${critiqueLabel(issue)}${issue.text}`,
              )),
        ],
      },
    ];
  }

  return [
    {
      channel: "content",
      entries: [`\t${chalk.gray("✗ UNVERIFIED")}`, `\t${chalk.dim("·")} ${event.message}`],
    },
  ];
};

export default runProgressView;

/**
 * The line printed before a unit is reviewed.
 *
 * `cohortSize` is set only for cohort units, and `reviewerName` only when
 * more than one reviewer is running — a single-reviewer run of plain
 * files gets the bare counter and filename.
 */
function unitHeading(event: {
  index: number;
  total: number;
  path: string;
  cohortSize?: number;
  reviewerName?: string;
}): string {
  const counter = chalk.dim(`[${event.index}/${event.total}]`);
  const cohort = event.cohortSize ? ` ${chalk.dim(`(cohort · ${event.cohortSize} files)`)}` : "";
  const reviewer = event.reviewerName ? ` ${chalk.cyan(`[reviewer: ${event.reviewerName}]`)}` : "";

  return `${counter} ${chalk.bold(baseName(event.path))}${cohort}${reviewer}`;
}

/** The colored ✓/⚠/✗ mark for a verdict. */
function verdictMark(verdict: Verdict): string {
  if (verdict.compliant) return chalk.green("✓ PASS");

  if (verdict.severity === "warning") return chalk.yellow("⚠ WARN");

  return chalk.red("✗ FAIL");
}

/** The axiom citation prefix for a matched critique; empty on the open channel. */
function critiqueLabel(critique: { axiomId: string | null }): string {
  return critique.axiomId === null ? "" : chalk.cyan(`[${critique.axiomId}] `);
}
