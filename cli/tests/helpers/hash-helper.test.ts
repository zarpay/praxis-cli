import { describe, expect, it } from "vitest";

import { hash8 } from "@/helpers/hash-helper.js";

describe("hash8", () => {
  it("is an 8-char hex prefix, stable for equal input", () => {
    const first = hash8("some content");
    const again = hash8("some content");

    expect(first).toBe(again);
    expect(first).toMatch(/^[0-9a-f]{8}$/);
  });

  it("distinct inputs hash distinctly", () => {
    const one = hash8("one");
    const two = hash8("two");

    expect(one).not.toBe(two);
  });
});
