import type { CalibrationCaseOutcome } from "@/types.js";
import type { View } from "@framework/types.js";

import chalk from "chalk";

/**
 * One case × repeat as it lands: the case id, whether the reviewer's
 * verdict agreed with the adjudication, and both verdicts when it
 * did not — disagreement is the interesting output of a calibration.
 */
const calibrationProgressView: View<CalibrationCaseOutcome> = (outcome) => {
  const repeatLabel = outcome.repeat > 1 ? ` (repeat ${outcome.repeat})` : "";

  if (outcome.matched) {
    return [
      {
        channel: "content",
        entries: [`\t${chalk.green("✓")} ${outcome.caseId}${repeatLabel} — ${outcome.expected}`],
      },
    ];
  }

  const actual = outcome.actual ?? "unverified";

  return [
    {
      channel: "content",
      entries: [
        `\t${chalk.red("✗")} ${outcome.caseId}${repeatLabel} — expected ${outcome.expected}, got ${actual}`,
      ],
    },
  ];
};

export default calibrationProgressView;
