import type { ReviewedTarget, Verdict } from "@/types.js";
import type { DisplayEntry, View } from "@framework/types.js";

import chalk from "chalk";

/**
 * One named target's verdict as it lands: the badge, the issues if it
 * failed, and the reasoning when asked for.
 */
const reviewedTargetView: View<ReviewedTarget> = ({ path, verdict, reviewerName, verbose }) => {
  const label = reviewerName ? `${path} ${chalk.cyan(`[reviewer: ${reviewerName}]`)}` : path;

  return [
    {
      channel: "content",
      entries: [
        verdictBadge(label, verdict),
        ...(verdict.compliant ? [] : verdict.issues.map((issue) => `  - ${issue}`)),
        ...(verbose ? ["", "Reasoning:", verdict.reason] : []),
      ],
    },
  ];
};

export default reviewedTargetView;

/** The colored status badge for one verdict. */
function verdictBadge(label: string, verdict: Verdict): DisplayEntry {
  if (verdict.compliant) return { badge: "PASS", color: "green", value: label };

  if (verdict.severity === "warning") return { badge: "WARN", color: "yellow", value: label };

  return { badge: "FAIL", color: "red", value: label };
}
