import { describe, expect, it } from "vitest";

import { percent, statLines } from "@framework/views/stats.js";

describe("statLines", () => {
  it("aligns values to a common column", () => {
    const [a, b] = statLines([
      ["Experts", 3],
      ["Practices", 12],
    ]);

    expect(a.indexOf("3")).toBe(b.indexOf("12"));
  });

  it("renders 'Label:' then the value", () => {
    const [line] = statLines([["Experts", 3]]);

    expect(line).toMatch(/^ {2}Experts: +3$/);
  });

  it("lets an over-long label push its own value out rather than truncate", () => {
    const [line] = statLines([["A label much longer than the value column", 1]]);

    expect(line).toContain("A label much longer than the value column:");
    expect(line.trimEnd().endsWith("1")).toBe(true);
  });
});

describe("percent", () => {
  it("renders a 0-1 rate as a whole percent", () => {
    expect(percent(0.7631)).toBe("76%");
    expect(percent(0)).toBe("0%");
    expect(percent(1)).toBe("100%");
  });

  it("renders a null rate as an em dash — unmeasurable, not zero", () => {
    expect(percent(null)).toBe("—");
  });
});
