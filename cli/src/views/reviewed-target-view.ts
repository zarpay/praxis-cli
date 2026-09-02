import type { Finding, ReviewedTarget, Verdict } from "@/types.js";
import type { DisplayEntry, View } from "@framework/types.js";

import chalk from "chalk";

/**
 * One named target's outcome as it lands: the badge for the worst
 * verdict, then the deduplicated finding list (08) — matched findings
 * cite their axiom and count their witnesses, open-channel findings
 * carry the raw critique. The drill-down for a cited axiom is
 * `praxis axioms show <id>` (09).
 */
const reviewedTargetView: View<ReviewedTarget> = ({
  path,
  verdict,
  findings,
  reviewerCount,
  verbose,
}) => {
  return [
    {
      channel: "content",
      entries: [
        verdictBadge(path, verdict),
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
  if (verdict.compliant) return { badge: "PASS", color: "green", value: label };

  if (verdict.severity === "warning") return { badge: "WARN", color: "yellow", value: label };

  return { badge: "FAIL", color: "red", value: label };
}
