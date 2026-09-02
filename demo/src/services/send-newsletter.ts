import type { Store } from "../store/memory-store.js";

export function sendNewsletter(store: Store, input: { subject: string }): boolean {
  if (!input.subject) {
    throw new Error("bad subject");
  }

  const parlors = store.listParlors();

  console.log(`sending "${input.subject}" to fans of ${parlors.length} parlors`);

  return true;
}
