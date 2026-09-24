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
 * own value out, rather than truncating, and always keeps at least one
 * space before the value.
 *
 * @param rows - `[label, value]` pairs, rendered in order
 */
export function statLines(rows: [string, string | number][]): string[] {
  return rows.map(([label, value]) => {
    const padded = `${label}:`.padEnd(VALUE_COLUMN);
    const separator = padded.endsWith(" ") ? "" : " ";

    return `${INDENT}${padded}${separator}${value}`;
  });
}

/**
 * A 0–1 rate as a whole percent — "76%" — or an em dash when there is
 * no rate to show (a null rate is "not measurable", which is a
 * different fact from 0%).
 */
export function percent(rate: number | null): string {
  if (rate === null) return "—";

  return `${Math.round(rate * 100)}%`;
}
