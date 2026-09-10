import type { Result } from "../../domain/types.js";
import type { Store } from "../../store/memory-store.js";
import type { LoyaltyStanding, TrackPunchesInput } from "./loyalty-types.js";

/** Punches needed before a free scoop is earned. */
const FREE_SCOOP_THRESHOLD = 10;

/**
 * Reports a parlor's loyalty standing: one punch per review, a free
 * scoop at ten.
 *
 * Failure modes: unknown parlor id.
 */
export function run(store: Store, input: TrackPunchesInput): Result<LoyaltyStanding> {
  if (!store.getParlor(input.parlorId)) {
    return { ok: false, error: `no parlor with id "${input.parlorId}" — list parlors for valid ids` };
  }

  const punches = store.listReviews().filter((review) => review.parlorId === input.parlorId).length;

  return { ok: true, value: { punches, freeScoopEarned: punches >= FREE_SCOOP_THRESHOLD } };
}
