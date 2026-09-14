import type { Parlor, RankedParlor, Result } from "../domain/types.js";
import type { Store } from "../store/memory-store.js";

/** Input for the parlor service. */
export interface ParlorInput {
  parlorId: string;
  newCity?: string;
}

/**
 * Handles a parlor.
 *
 * Failure modes: the parlor does not exist.
 */
export function run(store: Store, input: ParlorInput): Result<RankedParlor> {
  const parlor = store.getParlor(input.parlorId);

  if (!parlor) {
    return { ok: false, error: "parlor must be an id returned by listParlors" };
  }

  const reviews = store.listReviews(parlor.id);
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);

  if (input.newCity !== undefined) {
    parlor.city = input.newCity;
  }

  return {
    ok: true,
    value: {
      parlor,
      reviewCount: reviews.length,
      averageRating: reviews.length === 0 ? 0 : total / reviews.length,
    },
  };
}

/** Renders a parlor for display in the weekly digest email. */
export function formatParlor(parlor: Parlor): string {
  return `${parlor.name} (${parlor.city}) — ${parlor.signatureFlavor}`;
}

/** Whether a parlor is eligible for the loyalty programme. */
export function isEligible(parlor: Parlor, reviewCount: number): boolean {
  return reviewCount >= 5 && parlor.city !== "";
}
