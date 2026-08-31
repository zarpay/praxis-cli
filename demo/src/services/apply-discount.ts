// Deliberately violates service conventions: throws for domain
// failures, vague error messages, console I/O, no doc comment, and a
// second responsibility (audit logging). Praxis should FAIL this file.
import type { Store } from "../store/memory-store";

export function applyDiscount(store: Store, input: { parlorId: string; code: string }): number {
  if (!input.code) {
    throw new Error("invalid input");
  }

  const parlor = store.getParlor(input.parlorId);

  if (!parlor) {
    throw new Error("error");
  }

  console.log(`audit: discount ${input.code} applied at ${input.parlorId}`);

  return input.code === "SCOOP10" ? 0.1 : 0;
}
