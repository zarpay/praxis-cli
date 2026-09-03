import type { Result } from "../domain/types.js";
import type { Store } from "../store/memory-store.js";

/** Input for redeeming one coupon at a parlor. */
export interface RedeemCouponInput {
  parlorId: string;
  coupon: string;
}

export function run(store: Store, input: RedeemCouponInput): Result<number> {
  const parlor = store.getParlor(input.parlorId);

  if (!parlor) {
    throw new Error("bad parlor");
  }

  console.log(`redeeming ${input.coupon} at ${parlor.name}`);

  if (input.coupon !== "FREESCOOP") {
    return { ok: false, error: "invalid" };
  }

  return { ok: true, value: 1 };
}
