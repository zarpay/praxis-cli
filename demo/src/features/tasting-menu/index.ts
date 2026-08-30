/**
 * Tasting Menu — curated flavor tours across parlors.
 *
 * The feature's single entry point: consumers import from here and
 * never from the files behind it.
 */
export { run as buildMenu, type BuildMenuInput } from "./build-menu.js";
export type { TastingMenu, TastingStop } from "./menu-types.js";
