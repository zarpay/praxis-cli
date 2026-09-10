import chalk from "chalk";

/**
 * The semantic palette: every color has exactly one meaning, so a
 * reader learns the vocabulary once. Views style through these tokens,
 * never through raw chalk calls — if two things share a color they mean
 * the same kind of thing, and that only holds when the meaning picks
 * the color.
 */
export const palette = {
  /** Structure: headings, card titles, table headers. */
  structure: chalk.bold,
  /** An actionable reference — an id or command the reader can act on. */
  ref: chalk.cyan,
  /** Provenance and metadata: who, when, where, from-what. Also frames. */
  meta: chalk.gray,
  /** Verdict: pass / active. */
  good: chalk.green,
  /** Verdict: warn / held / stale. */
  warn: chalk.yellow,
  /** Verdict: fail. */
  bad: chalk.red,
  /** A queue that needs a human. */
  attention: chalk.magenta,
  /** Quoted content: the reviewer's words, statements, code. */
  quote: chalk.dim,
};

/** The string with any ANSI styling removed — its printable form. */
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

/** The printable width of a possibly-styled string. */
export function printableWidth(text: string): number {
  return stripAnsi(text).length;
}

/** Pads a possibly-styled string to a printable width. */
export function padPrintable(text: string, width: number): string {
  return text + " ".repeat(Math.max(0, width - printableWidth(text)));
}
