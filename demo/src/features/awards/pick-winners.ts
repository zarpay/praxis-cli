import type { Result } from "../../domain/types.js";
import type { Store } from "../../store/memory-store.js";
import type { Award } from "./award-types.js";

/** Input for picking award winners; minReviews qualifies parlors. */
export interface PickWinnersInput {
  minReviews: number;
}

/**
 * Picks the yearly awards: Golden Cone for the highest average rating,
 * People's Choice for the most reviews. Ties break by parlor name.
 *
 * Failure modes: minReviews negative or not a whole number; no parlor
 * qualifies under minReviews.
 */
export function run(store: Store, input: PickWinnersInput): Result<Award[]> {
  if (!Number.isInteger(input.minReviews) || input.minReviews < 0) {
    return { ok: false, error: "minReviews must be a whole number of 0 or more" };
  }

  const standings = store
    .listParlors()
    .map((parlor) => {
      const reviews = store.listReviews(parlor.id);
      const total = reviews.reduce((sum, review) => sum + review.rating, 0);
      return {
        parlor,
        count: reviews.length,
        average: reviews.length === 0 ? 0 : total / reviews.length,
      };
    })
    .filter((entry) => entry.count >= input.minReviews)
    .sort((a, b) => b.average - a.average || a.parlor.name.localeCompare(b.parlor.name));

  if (standings.length === 0) {
    return { ok: false, error: `no parlor has ${input.minReviews} or more reviews yet` };
  }

  const byCount = [...standings].sort(
    (a, b) => b.count - a.count || a.parlor.name.localeCompare(b.parlor.name),
  );

  return {
    ok: true,
    value: [
      {
        title: "Golden Cone",
        parlorId: standings[0].parlor.id,
        reason: `highest average rating (${standings[0].average.toFixed(1)})`,
      },
      {
        title: "People's Choice",
        parlorId: byCount[0].parlor.id,
        reason: `most reviews (${byCount[0].count})`,
      },
    ],
  };
}
