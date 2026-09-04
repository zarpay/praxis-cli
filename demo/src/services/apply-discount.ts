import type { Result } from "../domain/types.js";
import type { Store } from "../store/memory-store.js";

/** Input for applying a member discount at a parlor. */
export interface ApplyDiscountInput {
  parlorId: string;
  memberId: string;
}

export function run(store: Store, input: ApplyDiscountInput): Result<number> {
  const parlor = store.getParlor(input.parlorId);

  if (!parlor) {
    return { ok: false, error: "invalid" };
  }

  if (!input.memberId) {
    return { ok: false, error: "error" };
  }

  return { ok: true, value: 0.1 };
}
