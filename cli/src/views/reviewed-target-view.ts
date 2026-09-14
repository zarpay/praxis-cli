import type { Finding, ReviewedTarget, Verdict } from "@/types.js";
import type { DisplayEntry, View } from "@framework/types.js";

import chalk from "chalk";

import { splitPathTail } from "@/helpers/paths-helper.js";
import { badge } from "@framework/views/badges.js";
import { pathLabel } from "@framework/views/path-label.js";

/**
 * One named target's outcome as it lands: the badge for the worst
 * verdict, then the deduplicated finding list — raw reviewer prose,
 * with witnesses counted when several reviewers agree. Labels arrive
 * later, at triage, and show in reports.
 *
 * The path is shown as the caller typed it, directory receding and
 * filename forward — the same shape the run stream uses.
 */
const reviewedTargetView: View<ReviewedTarget> = ({
  path,
  verdict,
  findings,
  reviewerCount,
  verbose,
}) => {
  const parts = splitPathTail(path);
  const target = pathLabel(parts);

  return [
    {
      channel: "content",
      entries: [
        "",
        verdictBadge(target, verdict),
        ...findings.map((finding) => findingLine(finding, reviewerCount)),
        ...(verbose ? ["", "Reasoning:", verdict.reason] : []),
      ],
    },
  ];
};

export default reviewedTargetView;

/** One finding's line: its axiom when matched, its witnesses when several. */
function findingLine(finding: Finding, reviewerCount: number): string {
  const label = finding.axiomId === null ? "" : `${chalk.cyan(`[${finding.axiomId}]`)} `;

  const corroboration =
    reviewerCount > 1
      ? chalk.gray(` (${finding.witnesses.length}/${reviewerCount} reviewers)`)
      : "";

  return `  - ${label}${finding.text}${corroboration}`;
}

/** The colored status badge for one verdict. */
function verdictBadge(label: string, verdict: Verdict): DisplayEntry {
  if (verdict.compliant) return badge("PASS", "green", label);

  if (verdict.severity === "warning") return badge("WARN", "yellow", label);

  return badge("FAIL", "red", label);
}
