import type { Orientation } from "@/types.js";
import type { View } from "@framework/types.js";

import chalk from "chalk";

/**
 * Bare `praxis` (09-h): the project at a glance, every line naming the
 * command that acts on it — drill-down, not dumps.
 */
const orientationView: View<Orientation> = (orientation) => {
  const lastRunLine =
    orientation.lastRun === null
      ? "Last run: never — `praxis eval run` reviews everything and opens the ledger"
      : `Last run: ${orientation.lastRun.at.slice(0, 10)} by ${orientation.lastRun.reviewerName}${orientation.lastRun.anchored ? "" : " (unanchored — feedback, not measurement)"}`;

  const debtLines = (orientation.debtLine ?? []).map(
    (entry) =>
      `  ${entry.reviewerName}: ${entry.errors} failing at last full run — \`praxis debt report\``,
  );

  return [
    { channel: "heading", text: "Praxis" },
    {
      channel: "content",
      entries: [
        lastRunLine,
        `Axioms: ${orientation.activeAxioms} active · ${orientation.proposalsPending} awaiting ratification (\`praxis axioms list\`)`,
        `Pending triage: ${orientation.pendingTriage} (\`praxis axioms triage\`)`,
        chalk.gray(`Calibration: ${orientation.calibration}`),
        ...debtLines,
        "",
        "Reports: `praxis eval report` · `praxis debt report` · `praxis status --json`",
      ],
    },
  ];
};

export default orientationView;
