// Deliberately violates test conventions: vague subject framing, no
// "when" clauses, several unrelated assertions in one it block, and it
// tests implementation details (internal array ordering) instead of
// behavior. The tests themselves pass — Praxis should flag the style.
import { describe, expect, it } from "vitest";

import { applyDiscount } from "../src/services/apply-discount";
import { createMemoryStore } from "../src/store/memory-store";

describe("should work", () => {
  it("does stuff", () => {
    const store = createMemoryStore();
    const parlor = store.listParlors()[0];

    expect(applyDiscount(store, { parlorId: parlor.id, code: "SCOOP10" })).toBe(0.1);
    expect(applyDiscount(store, { parlorId: parlor.id, code: "NOPE" })).toBe(0);
    expect(store.listParlors().length).toBeGreaterThan(0);
    expect(store.listParlors()[0].id).toBe(parlor.id);
    expect(() => applyDiscount(store, { parlorId: parlor.id, code: "" })).toThrow();
  });
});
