import chalk, { type ChalkInstance } from "chalk";
import { type Writable } from "node:stream";

/**
 * Colored logger for CLI output.
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
