import type { RateCell } from "@/types.js";

/**
 * The metric rules (07) as one vocabulary, used by every builder and
 * renderer — which is how "enforced in every renderer" stays true
 * rather than described. A rate never appears without its denominator,
 * and a cell under the floor says "insufficient data", never a number.
 */

/** Cells with fewer applicable opportunities than this suppress (07 rule 3). */
export const SMALL_N_FLOOR = 5;

/**
 * One floor-aware rate: numerator over denominator, displayed with the
 * denominator shown, or suppressed below the small-n floor.
 */
export function rateCell(numerator: number, denominator: number): RateCell {
  if (denominator < SMALL_N_FLOOR) {
    return {
      numerator,
      denominator,
      rate: null,
      display: `insufficient data (n<${SMALL_N_FLOOR})`,
    };
  }

  const rate = numerator / denominator;

  return {
    numerator,
    denominator,
    rate,
    display: `${numerator}/${denominator} (${(rate * 100).toFixed(1)}%)`,
  };
}
