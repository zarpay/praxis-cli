/**
 * Awards — yearly parlor distinctions computed from review standings.
 *
 * The feature's single entry point: consumers import from here and
 * never from the files behind it.
 */
export { run as pickWinners, type PickWinnersInput } from "./pick-winners.js";
export type { Award } from "./award-types.js";
