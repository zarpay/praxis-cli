import type { LabelProgressEvent } from "@/types.js";
import type { View } from "@framework/types.js";

import chalk from "chalk";

/**
 * One labeling verdict as it lands (04): which critique, what the
 * matcher decided, and where the critique goes next.
 */
const labelProgressView: View<LabelProgressEvent> = (event) => {
  const counter = chalk.gray(`[${event.done}/${event.total}]`);
  const subject = `${event.critiqueId} ${chalk.gray(event.filePath)}`;

  if (event.outcome === "labeled") {
    return [
      {
        channel: "content",
        entries: [`${counter} ${subject} → ${chalk.cyan(event.axiomId ?? "")}`],
      },
    ];
  }

  if (event.outcome === "unmatched") {
    return [
      {
        channel: "content",
        entries: [`${counter} ${subject} → ${chalk.yellow("no match")} (curate)`],
      },
    ];
  }

  return [
    {
      channel: "content",
      entries: [`${counter} ${subject} → ${chalk.red("failed")} (stays untriaged)`],
    },
  ];
};

export default labelProgressView;
