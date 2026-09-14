import type { EvalProgress, Verdict } from "@/types.js";
import type { View } from "@framework/types.js";

import chalk from "chalk";

import { splitPathTail } from "@/helpers/paths-helper.js";
import { pathLabel } from "@framework/views/path-label.js";

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
          `  ${verdictMark(event.verdict)}`,
          ...(event.verdict.compliant
            ? []
            : event.verdict.issues.map((issue) => `  ${chalk.dim("·")} ${issue.text}`)),
        ],
      },
    ];
  }

  return [
    {
      channel: "content",
      entries: [`  ${chalk.gray("✗ UNVERIFIED")}`, `  ${chalk.dim("·")} ${event.message}`],
    },
  ];
};

export default runProgressView;

/**
 * The line printed before a unit is reviewed.
 *
 * The target is named by its whole root-relative path — a basename alone
 * cannot say which `helpers.ts` a critique landed on — with the
 * directory receding and the filename forward.
 *
 * `cohortSize` is set only for cohort units, and `reviewerName` only when
 * more than one reviewer is running — a single-reviewer run of plain
 * files gets the bare counter and path.
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
  const parts = splitPathTail(event.path);
  const target = pathLabel(parts);

  return `${counter} ${target}${cohort}${reviewer}`;
}

/** The colored ✓/⚠/✗ mark for a verdict. */
function verdictMark(verdict: Verdict): string {
  if (verdict.compliant) return chalk.green("✓ PASS");

  if (verdict.severity === "warning") return chalk.yellow("⚠ WARN");

  return chalk.red("✗ FAIL");
}
