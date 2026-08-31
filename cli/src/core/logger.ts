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

/** Chalk styles a Display line or badge may name. */
export type LineColor = "green" | "yellow" | "red" | "blue" | "cyan" | "gray" | "dim" | "bold";

/**
 * One renderable line: plain text, a `[color, text]` tuple to style the
 * whole line, or a falsy value to skip it — so conditional lines inline
 * naturally (`count > 0 && `...``).
 */
export type DisplayLine = string | readonly [LineColor, string] | null | false | undefined;

/**
 * Renders a command's user-facing output to stdout.
 *
 * Where {@link Logger} carries diagnostics on stderr, Display carries
 * the output itself: verdicts, summaries, reports. Its vocabulary is
 * the CLI's few rendering idioms — line blocks, colored `[BADGE]`
 * labels, and titled dividers — so callers describe output as data
 * instead of stacking `console.log` calls.
 *
 * Chalk handles NO_COLOR and non-TTY detection itself, so colored
 * entries degrade to plain text automatically when piped.
 */
export class Display {
  /** Writes one line; a falsy entry is skipped, no argument means a blank line. */
  line(entry: DisplayLine = ""): void {
    if (entry === null || entry === false || entry === undefined) return;

    if (typeof entry === "string") {
      console.log(entry);
      return;
    }

    const [color, text] = entry;
    console.log(chalk[color](text));
  }

  /** Writes each entry on its own line, skipping falsy entries. */
  lines(entries: readonly DisplayLine[]): void {
    for (const entry of entries) {
      // Skipped here rather than delegated: line()'s no-argument default
      // would otherwise turn an explicit `undefined` into a blank line.
      if (entry === null || entry === false || entry === undefined) continue;

      this.line(entry);
    }
  }

  /** Writes a colored `[LABEL]` badge, optionally followed by a message and indented. */
  badge(
    color: LineColor,
    label: string,
    message = "",
    { indent = 0 }: { indent?: number } = {},
  ): void {
    const badge = chalk[color](`[${label}]`);
    console.log(`${" ".repeat(indent)}${badge}${message ? ` ${message}` : ""}`);
  }

  /** Writes a title between two divider lines. */
  header(title: string, { char = "=", width = 50 }: { char?: string; width?: number } = {}): void {
    const divider = char.repeat(width);
    this.lines([divider, title, divider]);
  }
}
