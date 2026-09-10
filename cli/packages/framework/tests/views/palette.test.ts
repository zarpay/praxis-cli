import { describe, expect, it } from "vitest";

import { padPrintable, palette, printableWidth, stripAnsi } from "@framework/views/palette.js";

describe("palette", () => {
  it("names every semantic token", () => {
    const tokens = ["structure", "ref", "meta", "good", "warn", "bad", "attention", "quote"];

    for (const token of tokens) expect(palette).toHaveProperty(token);
  });
});

describe("printable helpers", () => {
  it("measures and pads through ANSI styling", () => {
    const styled = "[32mactive[39m";

    expect(stripAnsi(styled)).toBe("active");
    expect(printableWidth(styled)).toBe(6);
    expect(stripAnsi(padPrintable(styled, 10))).toBe("active    ");
  });
});
