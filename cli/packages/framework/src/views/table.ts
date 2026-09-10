import { padPrintable, palette, printableWidth } from "@framework/views/palette.js";

/** Indent every table line carries. */
const INDENT = "  ";

/**
 * An outlined, column-aligned table — the one table the CLI draws
 * (owner, 2026-09-10: outlined tables everywhere).
 *
 * Box-drawing borders render through `palette.meta` so the frame
 * recedes and the data pops. Each column is padded to its widest cell,
 * ANSI-aware: cells may arrive pre-styled (a colored status, a cyan
 * id), and widths are computed on the printable text.
 *
 * @param rows - Row-major cells; every row should have the same length
 * @param headers - Optional header row, bolded, above a rule
 */
export function table(rows: (string | number)[][], headers?: string[]): string[] {
  const body = rows.map((row) => row.map(String));
  const all = headers ? [headers, ...body] : body;

  if (all.length === 0) return [];

  const widths = columnWidths(all);
  const edge = (left: string, joint: string, right: string) =>
    palette.meta(left + widths.map((width) => "─".repeat(width + 2)).join(joint) + right);

  const lines = [INDENT + edge("┌", "┬", "┐")];

  if (headers) {
    const bolded = headers.map((header) => palette.structure(header));

    lines.push(INDENT + renderRow(bolded, widths));
    lines.push(INDENT + edge("├", "┼", "┤"));
  }

  for (const row of body) lines.push(INDENT + renderRow(row, widths));

  lines.push(INDENT + edge("└", "┴", "┘"));

  return lines;
}

/** The widest printable cell in each column. */
function columnWidths(rows: string[][]): number[] {
  const count = Math.max(...rows.map((row) => row.length));
  const widths: number[] = [];

  for (let column = 0; column < count; column++) {
    widths.push(Math.max(...rows.map((row) => printableWidth(row[column] ?? ""))));
  }

  return widths;
}

/** One bordered row: `│ cell │ cell │`. */
function renderRow(row: string[], widths: number[]): string {
  const wall = palette.meta("│");
  const cells = widths.map((width, column) => ` ${padPrintable(row[column] ?? "", width)} `);

  return wall + cells.join(wall) + wall;
}
