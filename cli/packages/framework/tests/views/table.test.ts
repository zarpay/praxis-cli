import { describe, expect, it } from "vitest";

import { stripAnsi } from "@framework/views/palette.js";
import { table } from "@framework/views/table.js";

/** The printable text of each rendered line. */
function plain(lines: string[]): string[] {
  return lines.map((line) => stripAnsi(line));
}

describe("table", () => {
  it("pads columns so every wall aligns", () => {
    const lines = plain(
      table([
        ["ab", "x"],
        ["a", "xyz"],
      ]),
    );

    const widths = new Set(lines.map((line) => line.length));

    expect(widths.size).toBe(1);
  });

  it("outlines the table, headers above a rule", () => {
    const lines = plain(table([["flash", "8"]], ["Reviewer", "Verdicts"]));

    expect(lines[0]).toMatch(/^\s*┌.*┬.*┐$/);
    expect(lines[1]).toContain("Reviewer");
    expect(lines[2]).toMatch(/^\s*├.*┼.*┤$/);
    expect(lines[3]).toContain("flash");
    expect(lines[4]).toMatch(/^\s*└.*┴.*┘$/);
  });

  it("computes widths on printable text, so styled cells align", () => {
    const styled = "\u001b[32mactive\u001b[39m";
    const lines = plain(
      table([
        [styled, "1"],
        ["deprecated", "2"],
      ]),
    );

    const widths = new Set(lines.map((line) => line.length));

    expect(widths.size).toBe(1);
  });

  it("returns nothing for no rows and no headers", () => {
    expect(table([])).toEqual([]);
  });

  it("stringifies numeric cells", () => {
    const lines = plain(table([[42, "ok"]]));

    expect(lines[1]).toContain("42");
  });
});
