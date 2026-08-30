import type { Parlor, Review } from "../domain/types.js";

/**
 * In-memory persistence for the demo.
 *
 * Services never touch storage directly — they receive a Store, which
 * keeps them pure enough to test and keeps I/O concerns in one place.
 * This implementation is a Map; a real one would be a database.
 */
export interface Store {
  getParlor(id: string): Parlor | undefined;
  listParlors(): Parlor[];
  listReviews(parlorId?: string): Review[];
  addReview(review: Review): void;
}

/** Creates a Store seeded with a few parlors so the API has data on boot. */
export function createMemoryStore(): Store {
  const parlors = new Map<string, Parlor>([
    ["p1", { id: "p1", name: "The Waffle Cone", city: "Portland", signatureFlavor: "Brown Butter Sage" }],
    ["p2", { id: "p2", name: "Frostbite Creamery", city: "Chicago", signatureFlavor: "Blood Orange Sorbet" }],
    ["p3", { id: "p3", name: "Churn & Burn", city: "Austin", signatureFlavor: "Smoked Vanilla" }],
  ]);
  const reviews: Review[] = [];

  return {
    getParlor: (id) => parlors.get(id),
    listParlors: () => [...parlors.values()],
    listReviews: (parlorId) =>
      parlorId ? reviews.filter((r) => r.parlorId === parlorId) : [...reviews],
    addReview: (review) => {
      reviews.push(review);
    },
  };
}
