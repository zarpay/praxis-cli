/** Gap between columns. */
const COLUMN_GAP = "  ";

/** Indent every table row carries. */
const INDENT = "  ";

/**
 * A column-aligned table, header optional.
 *
 * Each column is padded to its widest cell, so the caller supplies
 * data and never counts characters. The last column is not padded,
 * leaving no trailing whitespace on any line.
 *
 * Cells are stringified as given: color them before passing them in
 * only if the output is going to a terminal, since ANSI codes count
 * toward a string's length and will skew the alignment.
 *
 * @param rows - Row-major cells; every row should have the same length
 * @param headers - Optional header row, rendered above a dashed rule
 */
export function table(rows: (string | number)[][], headers?: string[]): string[] {
  const body = rows.map((row) => row.map(String));
  const all = headers ? [headers, ...body] : body;

  if (all.length === 0) return [];

  const widths = columnWidths(all);
  const lines = body.map((row) => renderRow(row, widths));

  if (!headers) return lines;

  const rule = widths.map((width) => "-".repeat(width));

  return [renderRow(headers, widths), renderRow(rule, widths), ...lines];
}

/** The widest cell in each column. */
function columnWidths(rows: string[][]): number[] {
  const count = Math.max(...rows.map((row) => row.length));
  const widths: number[] = [];

  for (let column = 0; column < count; column++) {
    widths.push(Math.max(...rows.map((row) => (row[column] ?? "").length)));
  }

  return widths;
}

/** Pads every cell but the last, so no line ends in whitespace. */
function renderRow(row: string[], widths: number[]): string {
  const padded = row.map((cell, column) =>
    column === row.length - 1 ? cell : cell.padEnd(widths[column] ?? 0),
  );

  return `${INDENT}${padded.join(COLUMN_GAP)}`.trimEnd();
}
