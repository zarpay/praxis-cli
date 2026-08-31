import type { ChalkInstance } from "chalk";
import type { Writable } from "node:stream";

import chalk from "chalk";

/**
 * The two output surfaces of the CLI live in this module:
 *
 * - {@link Logger} — diagnostics on stderr ([INFO]/[OK]/[WARN]/[ERROR]),
 *   kept off stdout so piped output stays clean.
 * - {@link Display} — the command's actual output on stdout: reports,
 *   summaries, verdicts.
 *
 * These are the only places allowed to call `console` (ESLint-enforced);
 * everything else renders through them.
 */

/**
 * Colored logger for CLI diagnostics.
 *
 * Writes to stderr by default (keeping stdout clean for piped output).
 * Respects the `NO_COLOR` environment variable and non-TTY streams
 * by automatically disabling color when appropriate.
 */
export class Logger {
  private readonly output: Writable;
  private readonly colorEnabled: boolean;

  constructor({
    output = process.stderr,
    color,
  }: {
    output?: Writable;
    color?: boolean;
  } = {}) {
    this.output = output;
    this.colorEnabled = color ?? this.detectColor();
  }

  /** Log an informational message (blue [INFO] prefix). */
  info(message: string): void {
    this.log("[INFO]", message, chalk.blue);
  }

  /** Log a success message (green [OK] prefix). */
  success(message: string): void {
    this.log("[OK]", message, chalk.green);
  }

  /** Log a warning message (yellow [WARN] prefix). */
  warn(message: string): void {
    this.log("[WARN]", message, chalk.yellow);
  }

  /** Log an error message (red [ERROR] prefix). */
  error(message: string): void {
    this.log("[ERROR]", message, chalk.red);
  }

  /**
   * Writes a formatted log line to the output stream.
   *
   * @param label - Status prefix like [INFO], [OK], etc.
   * @param message - The message body
   * @param colorFn - Chalk color function for the label
   */
  private log(label: string, message: string, colorFn: ChalkInstance): void {
    const prefix = this.colorEnabled ? colorFn(label) : label;
    this.output.write(`${prefix} ${message}\n`);
  }

  /**
   * Detects whether color output should be enabled.
   *
   * Returns false if NO_COLOR is set or the output stream is not a TTY.
   */
  private detectColor(): boolean {
    if (process.env["NO_COLOR"] !== undefined) {
      return false;
    }

    if ("isTTY" in this.output) {
      return !!(this.output as NodeJS.WriteStream).isTTY;
    }

    return false;
  }
}

/** Chalk styles a Display entry may name. */
export type LineColor = "green" | "yellow" | "red" | "blue" | "cyan" | "gray" | "dim" | "bold";

/** A line of text, optionally styled as a whole. */
export interface TextEntry {
  text: string;
  color?: LineColor;
}

/** A colored `[LABEL]` badge, optionally followed by a value and indented. */
export interface BadgeEntry {
  badge: string;
  color: LineColor;
  value?: string | number;
  indent?: number;
}

/** A title between two divider lines. */
export interface HeaderEntry {
  header: string;
  char?: string;
  width?: number;
}

/**
 * One renderable entry: a plain string, a structured entry, or a falsy
 * value to skip — so conditional entries inline naturally
 * (`count > 0 && { badge: ... }`).
 */
export type DisplayEntry =
  | string
  | TextEntry
  | BadgeEntry
  | HeaderEntry
  | null
  | false
  | undefined;

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
