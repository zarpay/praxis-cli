import { describe, expect, it } from "vitest";

import { table } from "@framework/views/table.js";

describe("table", () => {
  it("pads columns so the next column starts at one boundary", () => {
    const [a, b] = table([
      ["ab", "x"],
      ["a", "xyz"],
    ]);

    expect(a.indexOf("x")).toBe(b.indexOf("xyz"));
  });

  it("renders headers above a dashed rule", () => {
    const lines = table([["flash", "8"]], ["Reviewer", "Verdicts"]);

    expect(lines[0]).toContain("Reviewer");
    expect(lines[1]).toMatch(/^\s*-+ +-+\s*$/);
    expect(lines[2]).toContain("flash");
  });

  it("returns nothing for no rows and no headers", () => {
    expect(table([])).toEqual([]);
  });

  it("stringifies numeric cells", () => {
    const [line] = table([[42, "ok"]]);

    expect(line).toContain("42");
  });
});
