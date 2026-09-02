import type { Verdict } from "@/eval/types.js";

import chalk from "chalk";

import { baseName } from "@/framework/paths.js";

/**
 * The progress line printed before a unit is reviewed.
 *
 * `cohortSize` is set only for cohort units and `reviewerName` only when
 * more than one reviewer is running, so a single-reviewer run of plain files
 * gets the bare counter and filename.
 */
export function unitHeading({
  index,
  total,
  path,
  cohortSize,
  reviewerName,
}: {
  index: number;
  total: number;
  path: string;
  cohortSize?: number;
  reviewerName?: string;
}): string {
  const counter = chalk.dim(`[${index}/${total}]`);
  const cohortLabel = cohortSize ? ` ${chalk.dim(`(cohort · ${cohortSize} files)`)}` : "";
  const reviewerLabel = reviewerName ? ` ${chalk.cyan(`[reviewer: ${reviewerName}]`)}` : "";

  return `${counter} ${chalk.bold(baseName(path))}${cohortLabel}${reviewerLabel}`;
}

/** The colored ✓/⚠/✗ progress mark for a verdict. */
export function verdictMark(result: Verdict): string {
  if (result.compliant) return chalk.green("✓ PASS");

  if (result.severity === "warning") return chalk.yellow("⚠ WARN");

  return chalk.red("✗ FAIL");
}
