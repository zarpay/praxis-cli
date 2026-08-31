// A second, unrelated capability living in the same feature directory —
// violates "one capability per feature" and is orphaned (nothing
// imports it, and there is no index.ts to reach it from).
export const SUMMER_FLAVORS = ["mango", "peach melba", "cucumber lime"];

export function summerBannerText(): string {
  return `Try our summer flavors: ${SUMMER_FLAVORS.join(", ")}!`;
}
