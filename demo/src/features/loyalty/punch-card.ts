// Deliberately violates feature-module conventions (no index.ts entry
// point exists for this feature): Praxis should FAIL the loyalty cohort.
import type { Store } from "../../store/memory-store";

export function punchesFor(store: Store, parlorId: string): number {
  const reviews = store.listReviews().filter((r) => r.parlorId === parlorId);
  return reviews.length;
}

export function isFreeScoopEarned(store: Store, parlorId: string): boolean {
  return punchesFor(store, parlorId) >= 10;
}
