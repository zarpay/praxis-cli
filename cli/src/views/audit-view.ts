import type { AxiomAudit } from "@/types.js";
import type { View } from "@framework/types.js";

import chalk from "chalk";

/**
 * The gate re-assessment over active axioms (03): advisory rows a human
 * acts on. `not_appropriate` names a removal candidate — the standard
 * became mechanically checkable, or never needed judgment.
 */
const auditView: View<AxiomAudit & { json?: boolean }> = ({ rows, json }) => {
  if (json) {
    return [{ channel: "content", entries: [JSON.stringify(rows, null, 2)] }];
  }

  if (rows.length === 0) {
    return [{ channel: "content", entries: ["No active axioms to audit."] }];
  }

  const flagged = rows.filter((row) => row.assessment !== "appropriate").length;

  return [
    { channel: "heading", text: `Audit — ${rows.length} active axioms, ${flagged} flagged` },
    {
      channel: "content",
      entries: rows.map((row) => `${row.id}  ${label(row.assessment)}  ${row.reasoning}`),
    },
    ...(flagged > 0
      ? [
          {
            channel: "content" as const,
            entries: [
              "",
              "Flagged axioms are removal candidates: deprecate by editing status (history stays frozen, 04).",
            ],
          },
        ]
      : []),
  ];
};

export default auditView;

/** The assessment, colored by what it asks of the human. */
function label(assessment: string): string {
  if (assessment === "appropriate") return chalk.green(assessment.padEnd(15));

  if (assessment === "split") return chalk.yellow(assessment.padEnd(15));

  return chalk.red(assessment.padEnd(15));
}
