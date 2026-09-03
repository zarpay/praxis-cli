import type { AxiomReport } from "@/types.js";
import type { View } from "@framework/types.js";

import chalk from "chalk";

import { CALIBRATION_STATUS } from "@/helpers/metrics-helper.js";

/**
 * One axiom across everything in scope (07): the standard, per-reviewer
 * current-stock rates with population-qualified counts, and the
 * representative critiques with their ledger ids.
 */
const axiomReportView: View<AxiomReport & { json?: boolean }> = (report) => {
  if (report.json) {
    const { json: _json, ...payload } = report;

    return [{ channel: "content", entries: [JSON.stringify(payload, null, 2)] }];
  }

  const examples = report.examples.map(
    (example) =>
      `  ${chalk.gray(example.id)} ${example.filePath} ${chalk.gray(`[${example.reviewerName}]`)}\n    ${example.text}`,
  );

  return [
    {
      channel: "heading",
      text: `${report.axiomId} v${report.version} — ${report.status} (${report.severity})`,
    },
    { channel: "warning", text: `Calibration: ${CALIBRATION_STATUS}` },
    {
      channel: "content",
      entries: [
        report.statement,
        `grounded in: ${report.groundedIn ?? "— (not ratified)"} · introduced: ${report.introduced}`,
        "",
        ...report.rows.map(
          (row) =>
            `[${row.reviewerName}] current stock: ${row.rate.display} · files ever flagged: ${row.files} · pre-spec ${row.byPopulation.pre_spec} / post-spec ${row.byPopulation.post_spec} / unknown ${row.byPopulation.unknown}`,
        ),
        ...(examples.length > 0 ? ["", "Representative critiques:", ...examples] : []),
        "",
        "Removal candidacy: `praxis axioms audit` re-runs the authoring gate.",
      ],
    },
  ];
};

export default axiomReportView;
