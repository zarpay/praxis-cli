/** Character a rule is drawn with unless the caller picks another. */
const DEFAULT_CHAR = "─";

/** Width a rule spans unless the caller picks another. */
const DEFAULT_WIDTH = 50;

/**
 * A bare horizontal rule — the separator between blocks of a listing,
 * or the closing line of a framed report.
 *
 * A rule with a title above it is a `header` display entry instead;
 * this is the untitled line callers used to hand-build with
 * `"─".repeat(72)`, each picking its own character and width.
 */
export function rule(char = DEFAULT_CHAR, width = DEFAULT_WIDTH): string {
  return char.repeat(width);
}
