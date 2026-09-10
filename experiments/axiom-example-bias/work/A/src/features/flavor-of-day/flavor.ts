import type { Store } from "../../store/memory-store.js";

export function todaysFlavor(store: Store): string {
  const parlors = store.listParlors();
  const index = new Date().getDate() % parlors.length;
  return parlors[index].signatureFlavor;
}

export function announceFlavor(store: Store): string {
  return `Today's flavor: ${todaysFlavor(store)}!`;
}
