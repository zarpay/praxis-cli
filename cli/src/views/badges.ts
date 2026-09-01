import type { BadgeEntry, LineColor } from "@/types.js";

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
 * The standard pass/warn/fail/not-validated tally, in that order.
 *
 * The order and the colors are the project's convention for reporting
 * verdict counts; every place that shows them uses this so they can
 * never disagree.
 */
export function verdictTally(counts: {
  pass: number;
  warn: number;
  fail: number;
  notValidated: number;
}): BadgeEntry[] {
  return badgeBlock([
    ["PASS", "green", counts.pass],
    ["WARN", "yellow", counts.warn],
    ["FAIL", "red", counts.fail],
    ["NOT VALIDATED", "gray", counts.notValidated],
  ]);
}
