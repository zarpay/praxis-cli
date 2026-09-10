import { beforeEach, describe, expect, it } from "vitest";

import { buildMenu } from "../src/features/tasting-menu/index.js";
import { createMemoryStore, type Store } from "../src/store/memory-store.js";

describe("tasting-menu", () => {
  let store: Store;

  beforeEach(() => {
    store = createMemoryStore();
  });

  describe("when a tour of three stops is requested", () => {
    it("pairs each stop with the parlor's signature flavor", () => {
      const result = buildMenu(store, { stops: 3 });

      expect(result.ok && result.value.stops.map((stop) => stop.flavor)).toEqual([
        "Brown Butter Sage",
        "Blood Orange Sorbet",
        "Smoked Vanilla",
      ]);
    });

    it("titles the menu with the stop count", () => {
      const result = buildMenu(store, { stops: 3 });

      expect(result).toMatchObject({ ok: true, value: { title: "A 3-scoop tasting tour" } });
    });
  });

  describe("when more stops are requested than parlors exist", () => {
    it("caps the tour at the available parlors", () => {
      const result = buildMenu(store, { stops: 10 });

      expect(result.ok && result.value.stops).toHaveLength(3);
    });
  });

  describe("when stops is less than one", () => {
    it("fails stating the minimum", () => {
      const result = buildMenu(store, { stops: 0 });

      expect(result).toMatchObject({ ok: false, error: expect.stringContaining("1 or more") });
    });
  });
});
