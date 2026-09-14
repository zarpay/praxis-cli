import type { DisplayEntry, ReportLine } from "@framework/types.js";

import { stripAnsi } from "@framework/views/palette.js";

/**
 * Flattens a view's report into plain lines for assertion.
 *
 * Channel lines keep their level as a prefix (`[WARN] …`), content
 * entries flatten to their visible text — so a test can assert on what
 * a reader would see without replaying the renderer.
 *
 * Styling is stripped, because "visible text" has to mean the same
 * thing whether or not chalk is on. It is not, by default, under
 * vitest — which is exactly how a card that never wrapped styled text
 * survived a green suite until someone ran the CLI in a terminal.
 */
export function reportText(lines: ReportLine[]): string {
  const flattened = lines
    .map((line) => {
      switch (line.channel) {
        case "heading":
          return `[INFO] ${line.text}`;
        case "warning":
          return `[WARN] ${line.text}`;
        case "success":
          return `[OK] ${line.text}`;
        case "content":
          return line.entries.map(entryText).filter(Boolean).join("\n");
        case "blank":
          return "";
      }
    })
    .join("\n");

  return stripAnsi(flattened);
}

/** One content entry's visible text. */
function entryText(entry: DisplayEntry): string {
  if (!entry) return "";

  if (typeof entry === "string") return entry;

  if ("text" in entry) return entry.text;

  if ("badge" in entry) return `[${entry.badge}] ${entry.value ?? ""}`.trim();

  return entry.header;
}
