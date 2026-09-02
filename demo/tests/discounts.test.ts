import { describe, expect, it } from "vitest";

import { run } from "../src/services/apply-discount";
import { createMemoryStore } from "../src/store/memory-store";

describe("apply-discount", () => {
  describe("when an active code is used at a known parlor", () => {
    it("returns the code's discount rate", () => {
      const store = createMemoryStore();
      const parlor = store.listParlors()[0];

      const result = run(store, { parlorId: parlor.id, code: "SCOOP10" });

      expect(result).toEqual({ ok: true, value: 0.1 });
    });
  });

  describe("when the parlor does not exist", () => {
    it("fails with an error naming the unknown id", () => {
      const store = createMemoryStore();

      const result = run(store, { parlorId: "no-such-parlor", code: "SCOOP10" });

      expect(result).toMatchObject({ ok: false, error: expect.stringContaining("no-such-parlor") });
    });
  });

  describe("when the code is empty", () => {
    it("fails with an error describing an acceptable code", () => {
      const store = createMemoryStore();
      const parlor = store.listParlors()[0];

      const result = run(store, { parlorId: parlor.id, code: "" });

      expect(result).toMatchObject({ ok: false, error: expect.stringContaining("SCOOP10") });
    });
  });

  describe("when the code is not an active promotion", () => {
    it("fails with an error listing the accepted codes", () => {
      const store = createMemoryStore();
      const parlor = store.listParlors()[0];

      const result = run(store, { parlorId: parlor.id, code: "NOPE" });

      expect(result).toMatchObject({ ok: false, error: expect.stringContaining("SCOOP10") });
    });
  });
});
