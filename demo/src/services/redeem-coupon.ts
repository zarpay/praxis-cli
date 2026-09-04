import type { Result } from "../domain/types.js";
import type { Store } from "../store/memory-store.js";

/** Input for redeeming one coupon at a parlor. */
export interface RedeemCouponInput {
  parlorId: string;
  coupon: string;
}

/**
 * Redeems one coupon code at a parlor, returning the discount fraction.
 *
 * Failure modes: unknown parlor id; unrecognized coupon code (codes are
 * case-sensitive).
 */
export function run(store: Store, input: RedeemCouponInput): Result<number> {
  const parlor = store.getParlor(input.parlorId);

  if (!parlor) {
    return { ok: false, error: `parlor "${input.parlorId}" does not exist — use an id from the parlors list` };
  }

  console.log(`redeeming ${input.coupon} at ${parlor.name}`);

  if (input.coupon !== "FREESCOOP") {
    return { ok: false, error: `coupon "${input.coupon}" is not recognized — codes are case-sensitive` };
  }

  return { ok: true, value: 1 };
}
