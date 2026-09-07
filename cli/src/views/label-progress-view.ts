import type { LabelProgressEvent } from "@/types.js";
import type { View } from "@framework/types.js";

import chalk from "chalk";

/** Critique text longer than this is elided in the stream. */
const TEXT_WIDTH = 120;

/**
 * One labeling verdict as it lands: the critique on its own small card —
 * counter and file, the critique's words, then the verdict — followed by
 * a separating blank line, so a human can read the stream one critique
 * at a time.
 */
const labelProgressView: View<LabelProgressEvent> = (event) => {
  const counter = chalk.bold(`[${event.done}/${event.total}]`);
  const head = `${counter} ${event.filePath} ${chalk.gray(event.critiqueId)}`;
  const words = chalk.dim(`  ${elide(event.text)}`);

  return [
    {
      channel: "content",
      entries: [head, words, `  ${verdict(event)}`, ""],
    },
  ];
};

export default labelProgressView;

/** The verdict line for one outcome. */
function verdict(event: LabelProgressEvent): string {
  if (event.outcome === "labeled") {
    return `→ ${chalk.cyan(event.axiomId ?? "")}`;
  }

  if (event.outcome === "unmatched") {
    return `→ ${chalk.yellow("no match")} — goes to curate`;
  }

  return `→ ${chalk.red("call failed")} — stays untriaged; rerun triage to retry`;
}

/** The critique's words, elided to one readable stream line. */
function elide(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();

  return flat.length <= TEXT_WIDTH ? flat : `${flat.slice(0, TEXT_WIDTH - 1)}…`;
}
