import type { DisplayEntry, ReportLine } from "@framework/types.js";

/**
 * Flattens a view's report into plain lines for assertion.
 *
 * Channel lines keep their level as a prefix (`[WARN] …`), content
 * entries flatten to their visible text — so a test can assert on what
 * a reader would see without replaying the renderer.
 */
export function reportText(lines: ReportLine[]): string {
  return lines
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
}

/** One content entry's visible text. */
function entryText(entry: DisplayEntry): string {
  if (!entry) return "";

  if (typeof entry === "string") return entry;

  if ("text" in entry) return entry.text;

  if ("badge" in entry) return `[${entry.badge}] ${entry.value ?? ""}`.trim();

  return entry.header;
}
