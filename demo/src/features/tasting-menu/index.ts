/**
 * Tasting Menu — curated flavor tours across parlors.
 *
 * The feature's single entry point: consumers import from here and
 * never from the files behind it.
 */
export { run as buildMenu } from "./build-menu.js";
export type { BuildMenuInput, TastingMenu, TastingStop } from "./tasting-menu-types.js";
