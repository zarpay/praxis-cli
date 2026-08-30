import type { Result, Review } from "../domain/types.js";
import type { Store } from "../store/memory-store.js";

/** Input for creating a review of one parlor visit. */
export interface CreateReviewInput {
  parlorId: string;
  author: string;
  rating: number;
  tastingNotes: string;
}

/**
 * Records a member's review of a parlor.
 *
 * Failure modes: unknown parlor id; rating outside 1-5 or not a whole
 * number; empty author; tasting notes shorter than 12 characters.
 */
export function run(store: Store, input: CreateReviewInput): Result<Review> {
  if (!store.getParlor(input.parlorId)) {
    return { ok: false, error: `no parlor with id "${input.parlorId}" — list parlors for valid ids` };
  }
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    return { ok: false, error: "rating must be a whole number from 1 to 5" };
  }
  if (input.author.trim() === "") {
    return { ok: false, error: "author must be a non-empty name" };
  }
  if (input.tastingNotes.trim().length < 12) {
    return { ok: false, error: "tastingNotes must describe the visit in at least 12 characters" };
  }

  const review: Review = {
    id: `r${Date.now().toString(36)}`,
    parlorId: input.parlorId,
    author: input.author.trim(),
    rating: input.rating,
    tastingNotes: input.tastingNotes.trim(),
    createdAt: new Date().toISOString(),
  };
  store.addReview(review);

  return { ok: true, value: review };
}
