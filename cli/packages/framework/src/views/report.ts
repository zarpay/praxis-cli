import type { ReportLine } from "@framework/types.js";

import { Display } from "@framework/views/display.js";
import { Logger } from "@framework/views/logger.js";

/**
 * Prints a report a view assembled.
 *
 * The one place that knows which channel each kind of line belongs to,
 * so a command renders a whole report in a single call and holds no
 * ordering, no interleaving, and no decisions about what to show.
 */
export function renderReport(
  lines: ReportLine[],
  { out = new Display(), logger = new Logger() }: { out?: Display; logger?: Logger } = {},
): void {
  for (const line of lines) {
    switch (line.channel) {
      case "heading":
        logger.info(line.text);
        break;
      case "warning":
        logger.warn(line.text);
        break;
      case "success":
        logger.success(line.text);
        break;
      case "content":
        out.print(line.entries);
        break;
      case "blank":
        out.line();
        break;
    }
  }
}
