/**
 * Core domain types for Scoop Society.
 *
 * The domain is deliberately small: parlors serve flavors, members
 * review parlors. Everything else in the app exists to move these
 * three shapes around.
 */

/** An ice cream parlor that can be reviewed. */
export interface Parlor {
  id: string;
  name: string;
  city: string;
  signatureFlavor: string;
}

/** A member's review of one parlor visit. */
export interface Review {
  id: string;
  parlorId: string;
  author: string;
  /** Whole stars, 1-5. */
  rating: number;
  /** What the reviewer actually tasted and thought. */
  tastingNotes: string;
  createdAt: string;
}

/** A review as submitted, before persistence assigns id and createdAt. */
export type ReviewDraft = Omit<Review, "id" | "createdAt">;

/** A parlor with its aggregate review standing. */
export interface RankedParlor {
  parlor: Parlor;
  reviewCount: number;
  averageRating: number;
}

/**
 * The outcome shape every service returns.
 *
 * Domain failures are values, not exceptions: callers branch on `ok`
 * and always have an actionable `error` message when it is false.
 */
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
