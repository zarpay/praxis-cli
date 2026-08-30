import { beforeEach, describe, expect, it } from "vitest";

import { run as createReview } from "../src/services/create-review.js";
import { run } from "../src/services/rank-parlors.js";
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

describe("rank-parlors", () => {
  let store: Store;

  beforeEach(() => {
    store = createMemoryStore();
  });

  describe("when no parlors have reviews", () => {
    it("ranks every seeded parlor with a zero average", () => {
      const result = run(store, { minReviews: 0 });

      expect(result).toMatchObject({
        ok: true,
        value: [
          { reviewCount: 0, averageRating: 0 },
          { reviewCount: 0, averageRating: 0 },
          { reviewCount: 0, averageRating: 0 },
        ],
      });
    });
  });

  describe("when parlors have different ratings", () => {
    beforeEach(() => {
      reviewParlor(store, "p1", 3);
      reviewParlor(store, "p2", 5);
    });

    it("orders parlors by average rating, highest first", () => {
      const result = run(store, { minReviews: 0 });

      expect(result.ok && result.value.map((entry) => entry.parlor.id)).toEqual([
        "p2",
        "p1",
        "p3",
      ]);
    });

    it("averages multiple reviews of the same parlor", () => {
      reviewParlor(store, "p1", 5);

      const result = run(store, { minReviews: 0 });

      expect(result.ok && result.value.find((entry) => entry.parlor.id === "p1")).toMatchObject({
        reviewCount: 2,
        averageRating: 4,
      });
    });
  });

  describe("when a minimum review count is set", () => {
    it("excludes parlors with fewer reviews", () => {
      reviewParlor(store, "p2", 4);

      const result = run(store, { minReviews: 1 });

      expect(result.ok && result.value.map((entry) => entry.parlor.id)).toEqual(["p2"]);
    });
  });

  describe("when minReviews is negative", () => {
    it("fails stating zero or more is required", () => {
      const result = run(store, { minReviews: -1 });

      expect(result).toMatchObject({ ok: false, error: expect.stringContaining("0 or more") });
    });
  });
});
