import type { EvalUnit, Verdict } from "@/domains/eval/types.js";

import chalk from "chalk";

import { baseName } from "@/core/paths.js";

/** Whether a unit judges a set of files rather than the one at its path. */
export function isCohort(unit: EvalUnit): boolean {
  return unit.files.length > 1 || unit.files[0] !== unit.path;
}

/**
 * The progress line printed before a unit is judged.
 *
 * `cohortSize` is set only for cohort units and `judgeName` only when
 * more than one judge is running, so a single-judge run of plain files
 * gets the bare counter and filename.
 */
export function unitHeading({
  index,
  total,
  path,
  cohortSize,
  judgeName,
}: {
  index: number;
  total: number;
  path: string;
  cohortSize?: number;
  judgeName?: string;
}): string {
  const counter = chalk.dim(`[${index}/${total}]`);
  const cohortLabel = cohortSize ? ` ${chalk.dim(`(cohort · ${cohortSize} files)`)}` : "";
  const judgeLabel = judgeName ? ` ${chalk.cyan(`[judge: ${judgeName}]`)}` : "";

  return `${counter} ${chalk.bold(baseName(path))}${cohortLabel}${judgeLabel}`;
}

/** The colored ✓/⚠/✗ progress mark for a verdict. */
export function verdictMark(result: Verdict): string {
  if (result.compliant) return chalk.green("✓ PASS");

  if (result.severity === "warning") return chalk.yellow("⚠ WARN");

  return chalk.red("✗ FAIL");
}
