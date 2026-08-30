import { beforeEach, describe, expect, it } from "vitest";

import { pickWinners } from "../src/features/awards/index.js";
import { run as createReview } from "../src/services/create-review.js";
import { createMemoryStore, type Store } from "../src/store/memory-store.js";

/** Records a review with the given rating against one parlor. */
function reviewParlor(store: Store, parlorId: string, rating: number): void {
  createReview(store, {
    parlorId,
    rating,
    author: "Sebastian",
    tastingNotes: "Notes long enough to satisfy the minimum.",
  });
}

describe("awards", () => {
  let store: Store;

  beforeEach(() => {
    store = createMemoryStore();
  });

  describe("when parlors have distinct standings", () => {
    beforeEach(() => {
      reviewParlor(store, "p1", 5);
      reviewParlor(store, "p2", 3);
      reviewParlor(store, "p2", 4);
    });

    it("awards the Golden Cone to the highest average rating", () => {
      const result = pickWinners(store, { minReviews: 1 });

      expect(result.ok && result.value.find((award) => award.title === "Golden Cone")).toMatchObject(
        { parlorId: "p1" },
      );
    });

    it("awards the People's Choice to the most-reviewed parlor", () => {
      const result = pickWinners(store, { minReviews: 1 });

      expect(
        result.ok && result.value.find((award) => award.title === "People's Choice"),
      ).toMatchObject({ parlorId: "p2" });
    });
  });

  describe("when no parlor meets the review minimum", () => {
    it("fails naming the unmet minimum", () => {
      const result = pickWinners(store, { minReviews: 2 });

      expect(result).toMatchObject({ ok: false, error: expect.stringContaining("2 or more") });
    });
  });

  describe("when minReviews is negative", () => {
    it("fails stating zero or more is required", () => {
      const result = pickWinners(store, { minReviews: -1 });

      expect(result).toMatchObject({ ok: false, error: expect.stringContaining("0 or more") });
    });
  });
});
