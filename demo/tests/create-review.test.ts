import { beforeEach, describe, expect, it } from "vitest";

import { run } from "../src/services/create-review.js";
import { createMemoryStore, type Store } from "../src/store/memory-store.js";

/** A valid input against the seeded store; tests override one field at a time. */
function validInput() {
  return {
    parlorId: "p1",
    author: "Sebastian",
    rating: 5,
    tastingNotes: "The brown butter sage tastes like a warm cookie.",
  };
}

describe("create-review", () => {
  let store: Store;

  beforeEach(() => {
    store = createMemoryStore();
  });

  describe("when the input is valid", () => {
    it("returns the created review with the submitted fields", () => {
      const result = run(store, validInput());

      expect(result).toMatchObject({
        ok: true,
        value: { parlorId: "p1", author: "Sebastian", rating: 5 },
      });
    });

    it("makes the review visible on the parlor", () => {
      run(store, validInput());

      expect(store.listReviews("p1")).toHaveLength(1);
    });

    it("trims whitespace from the author name", () => {
      const result = run(store, { ...validInput(), author: "  Sebastian  " });

      expect(result).toMatchObject({ ok: true, value: { author: "Sebastian" } });
    });
  });

  describe("when the parlor does not exist", () => {
    it("fails with an error naming the unknown id", () => {
      const result = run(store, { ...validInput(), parlorId: "p9" });

      expect(result).toMatchObject({ ok: false, error: expect.stringContaining('"p9"') });
    });

    it("stores nothing", () => {
      run(store, { ...validInput(), parlorId: "p9" });

      expect(store.listReviews()).toHaveLength(0);
    });
  });

  describe("when the rating is out of range", () => {
    it("fails stating the accepted range", () => {
      const result = run(store, { ...validInput(), rating: 6 });

      expect(result).toMatchObject({ ok: false, error: expect.stringContaining("1 to 5") });
    });
  });

  describe("when the rating is not a whole number", () => {
    it("fails stating whole numbers are required", () => {
      const result = run(store, { ...validInput(), rating: 4.5 });

      expect(result).toMatchObject({ ok: false, error: expect.stringContaining("whole number") });
    });
  });

  describe("when the author is blank", () => {
    it("fails asking for a non-empty name", () => {
      const result = run(store, { ...validInput(), author: "   " });

      expect(result).toMatchObject({ ok: false, error: expect.stringContaining("non-empty") });
    });
  });

  describe("when the tasting notes are too short", () => {
    it("fails stating the minimum length", () => {
      const result = run(store, { ...validInput(), tastingNotes: "nice" });

      expect(result).toMatchObject({ ok: false, error: expect.stringContaining("12 characters") });
    });
  });
});
