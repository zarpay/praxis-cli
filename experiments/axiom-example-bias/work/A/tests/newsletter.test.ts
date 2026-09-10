import { describe, expect, it } from "vitest";

import { run as createReview } from "../src/services/create-review.js";
import { run } from "../src/services/send-newsletter.js";
import { createMemoryStore, type Store } from "../src/store/memory-store.js";

/** Records one review so its author becomes a newsletter recipient. */
function reviewAs(store: Store, author: string): void {
  const parlor = store.listParlors()[0];

  createReview(store, {
    parlorId: parlor.id,
    author,
    rating: 5,
    tastingNotes: "Notes long enough to satisfy the minimum.",
  });
}

describe("send-newsletter", () => {
  describe("when members have reviewed", () => {
    it("addresses each reviewing member exactly once", () => {
      const store = createMemoryStore();
      reviewAs(store, "Ada");
      reviewAs(store, "Ada");
      reviewAs(store, "Grace");

      const result = run(store, { subject: "Summer flavors!" });

      expect(result).toEqual({
        ok: true,
        value: { subject: "Summer flavors!", recipients: ["Ada", "Grace"] },
      });
    });
  });

  describe("when the subject is empty", () => {
    it("fails with an error describing an acceptable subject", () => {
      const store = createMemoryStore();
      reviewAs(store, "Ada");

      const result = run(store, { subject: "  " });

      expect(result).toMatchObject({ ok: false, error: expect.stringContaining("non-empty") });
    });
  });

  describe("when nobody has reviewed", () => {
    it("fails with an error naming the empty audience", () => {
      const store = createMemoryStore();

      const result = run(store, { subject: "Summer flavors!" });

      expect(result).toMatchObject({ ok: false, error: expect.stringContaining("nobody") });
    });
  });
});
