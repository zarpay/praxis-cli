import type { Result } from "../../domain/types.js";
import type { Store } from "../../store/memory-store.js";
import type { TastingMenu } from "./menu-types.js";

/** Input for building a tasting menu; stops caps the tour length. */
export interface BuildMenuInput {
  stops: number;
}

/**
 * Builds a tasting tour: up to `stops` parlors, each paired with its
 * signature flavor.
 *
 * Failure modes: stops less than 1 or not a whole number.
 */
export function run(store: Store, input: BuildMenuInput): Result<TastingMenu> {
  if (!Number.isInteger(input.stops) || input.stops < 1) {
    return { ok: false, error: "stops must be a whole number of 1 or more" };
  }

  const stops = store
    .listParlors()
    .slice(0, input.stops)
    .map((parlor) => ({ parlor, flavor: parlor.signatureFlavor }));

  return { ok: true, value: { title: `A ${stops.length}-scoop tasting tour`, stops } };
}
