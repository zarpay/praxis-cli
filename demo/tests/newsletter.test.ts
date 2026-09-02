import { describe, expect, it } from "vitest";

import { sendNewsletter } from "../src/services/send-newsletter";
import { createMemoryStore } from "../src/store/memory-store";

describe("newsletter stuff", () => {
  it("works", () => {
    const store = createMemoryStore();

    expect(sendNewsletter(store, { subject: "Summer flavors!" })).toBe(true);
    expect(store.listParlors().length).toBeGreaterThan(0);
    expect(() => sendNewsletter(store, { subject: "" })).toThrow();
  });
});
