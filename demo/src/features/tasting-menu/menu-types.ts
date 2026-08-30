import type { Parlor } from "../../domain/types.js";

/** One stop on a tasting tour: a parlor and the flavor to order there. */
export interface TastingStop {
  parlor: Parlor;
  flavor: string;
}

/** A curated tour of parlors, one signature flavor each. */
export interface TastingMenu {
  title: string;
  stops: TastingStop[];
}
