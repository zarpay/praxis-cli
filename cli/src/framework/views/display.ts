import type { BadgeEntry, DisplayEntry, HeaderEntry } from "@/framework/types.js";

import chalk from "chalk";

/**
 * Renders a command's user-facing output to stdout.
 *
 * Where {@link Logger} carries diagnostics on stderr, Display carries
 * the output itself: verdicts, summaries, reports. A whole output block
 * is one print() call with a payload of entries — plain strings, styled
 * text, `[BADGE]` labels, titled dividers — so callers describe output
 * as data instead of stacking calls.
 *
 * Chalk handles NO_COLOR and non-TTY detection itself, so colored
 * entries degrade to plain text automatically when piped.
 *
 * One of the two modules allowed to call `console` (ESLint-enforced).
 */
export class Display {
  /** Renders each entry in order, skipping falsy entries. */
  print(entries: readonly DisplayEntry[]): void {
    for (const entry of entries) {
      if (entry === null || entry === false || entry === undefined) continue;

      if (typeof entry === "string") {
        console.log(entry);
      } else if ("badge" in entry) {
        this.printBadge(entry);
      } else if ("header" in entry) {
        this.printHeader(entry);
      } else {
        console.log(entry.color ? chalk[entry.color](entry.text) : entry.text);
      }
    }
  }

  /** Renders a single entry; no argument means a blank line. */
  line(entry: DisplayEntry = ""): void {
    this.print([entry]);
  }

  /** Renders `[LABEL] value`, label colored, optionally indented. */
  private printBadge({ badge, color, value, indent = 0 }: BadgeEntry): void {
    const label = chalk[color](`[${badge}]`);
    const suffix = value === undefined ? "" : ` ${value}`;
    console.log(`${" ".repeat(indent)}${label}${suffix}`);
  }

  /** Renders a title between two divider lines. */
  private printHeader({ header, char = "=", width = 50 }: HeaderEntry): void {
    const divider = char.repeat(width);
    this.print([divider, header, divider]);
  }
}
