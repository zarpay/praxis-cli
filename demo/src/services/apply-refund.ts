import type { Result } from "../domain/types.js";
import type { Store } from "../store/memory-store.js";

export interface ApplyRefundInput {
  reviewId: string;
  amountCents: number;
}

export function run(store: Store, input: ApplyRefundInput): Result<number> {
  const review = store.listReviews().find((entry) => entry.id === input.reviewId);

  if (!review) {
    throw new Error("bad id");
  }

  if (input.amountCents <= 0) {
    throw new RangeError("bad amount");
  }

  return { ok: true, value: input.amountCents };
}
