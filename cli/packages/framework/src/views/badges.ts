import type { BadgeEntry, LineColor } from "@framework/types.js";

import { palette } from "@framework/views/palette.js";

/** Indent every badge in a tallied block shares. */
const BLOCK_INDENT = 2;

/**
 * One `[LABEL] value` badge.
 *
 * Callers used to hand-build these object literals, which is why the
 * indent drifted between blocks. Build them here instead.
 */
export function badge(label: string, color: LineColor, value?: string | number): BadgeEntry {
  return { badge: label, color, value };
}

/**
 * A block of badges sharing one indent, for a tallied group.
 *
 * @param rows - `[label, color, value]` triples, rendered in order
 */
export function badgeBlock(rows: [string, LineColor, string | number][]): BadgeEntry[] {
  return rows.map(([label, color, value]) => ({
    badge: label,
    color,
    value,
    indent: BLOCK_INDENT,
  }));
}

/**
 * The standard pass/warn/fail/not-validated tally, in that order, as
 * one line of colored dots (owner, 2026-09-10): scannable, and the
 * same order and colors every single time. The dots carry the color;
 * the counts stay in the default text color.
 */
export function verdictTally(counts: {
  pass: number;
  warn: number;
  fail: number;
  notValidated: number;
}): string {
  const cell = (paint: (s: string) => string, count: number, label: string) =>
    `${paint("●")} ${count} ${label}`;

  return [
    cell(palette.good, counts.pass, "pass"),
    cell(palette.warn, counts.warn, "warn"),
    cell(palette.bad, counts.fail, "fail"),
    cell(palette.meta, counts.notValidated, "not validated"),
  ].join("   ");
}
