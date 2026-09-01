/** Indent every stat line carries. */
const INDENT = "  ";

/** Column where values start, measured from the end of the indent. */
const VALUE_COLUMN = 20;

/**
 * An aligned `Label:  value` block.
 *
 * Labels are padded to a common column so values line up, which is
 * what makes a count block scannable. The padding used to be baked
 * into hand-written string literals, so adding a longer label meant
 * re-spacing every neighbour by hand.
 *
 * A label longer than the column still renders — it just pushes its
 * own value out, rather than truncating.
 *
 * @param rows - `[label, value]` pairs, rendered in order
 */
export function statLines(rows: [string, string | number][]): string[] {
  return rows.map(([label, value]) => `${INDENT}${`${label}:`.padEnd(VALUE_COLUMN)}${value}`);
}
