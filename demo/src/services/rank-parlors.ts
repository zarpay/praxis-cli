import type { RankedParlor, Result } from "../domain/types.js";
import type { Store } from "../store/memory-store.js";

/** Input for ranking parlors; minReviews filters out barely-reviewed parlors. */
export interface RankParlorsInput {
  minReviews: number;
}

/**
 * Ranks every parlor by average rating, highest first.
 *
 * Failure modes: minReviews negative or not a whole number.
 */
export function run(store: Store, input: RankParlorsInput): Result<RankedParlor[]> {
  if (!Number.isInteger(input.minReviews) || input.minReviews < 0) {
    return { ok: false, error: "minReviews must be a whole number of 0 or more" };
  }

  const ranked = store
    .listParlors()
    .map((parlor) => {
      const reviews = store.listReviews(parlor.id);
      const total = reviews.reduce((sum, review) => sum + review.rating, 0);
      return {
        parlor,
        reviewCount: reviews.length,
        averageRating: reviews.length === 0 ? 0 : total / reviews.length,
      };
    })
    .filter((entry) => entry.reviewCount >= input.minReviews)
    .sort((a, b) => b.averageRating - a.averageRating);

  return { ok: true, value: ranked };
}
