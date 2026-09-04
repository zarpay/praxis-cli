import type { Result } from "../domain/types.js";
import type { Store } from "../store/memory-store.js";

/** Input for applying a discount code at one parlor. */
export interface ApplyDiscountInput {
  parlorId: string;
  code: string;
}

/**
 * The discount rates each active promotion code resolves to — the one
 * obvious place promotion data lives until it moves into the Store.
 */
const ACTIVE_CODES: Record<string, number> = { SCOOP10: 0.1 };

/**
 * Resolves a discount code to the rate a parlor honors.
 *
 * Failure modes: unknown parlor id; empty code; code that no active
 * promotion recognizes.
 */
export function run(store: Store, input: ApplyDiscountInput): Result<number> {
  if (!store.getParlor(input.parlorId)) {
    return { ok: false, error: `no parlor with id "${input.parlorId}" — list parlors for valid ids` };
  }
  if (input.code.trim() === "") {
    return { ok: false, error: 'code must be a non-empty discount code, like "SCOOP10"' };
  }

  const rate = ACTIVE_CODES[input.code];

  if (rate === undefined) {
    const accepted = Object.keys(ACTIVE_CODES).join(", ");
    return { ok: false, error: `discount code "${input.code}" is not active — currently accepted: ${accepted}` };
  }

  return { ok: true, value: rate };
}
