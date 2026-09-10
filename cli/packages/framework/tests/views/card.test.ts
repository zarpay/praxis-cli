import { describe, expect, it } from "vitest";

import { card } from "@framework/views/card.js";
import { stripAnsi } from "@framework/views/palette.js";

/** The printable text of each rendered line. */
function plain(lines: string[]): string[] {
  return lines.map((line) => stripAnsi(line));
}

describe("card", () => {
  it("frames title, aligned attributes, body, and footer", () => {
    const lines = plain(
      card({
        title: "critique r1:1",
        attrs: [
          ["file", "src/a.ts"],
          ["reviewer", "flash · error"],
        ],
        body: ["The words the reviewer said."],
        footer: "standing  AX-aaaa11",
      }),
    );

    expect(lines[0]).toMatch(/^\s*╭─ critique r1:1 ─+╮$/);
    expect(lines[1]).toContain("file      src/a.ts");
    expect(lines[2]).toContain("reviewer  flash · error");
    expect(lines[4]).toContain("The words the reviewer said.");
    expect(lines[6]).toContain("standing  AX-aaaa11");
    expect(lines.at(-1)).toMatch(/^\s*╰─+╯$/);
  });

  it("keeps every wall aligned, top border included", () => {
    const lines = plain(card({ title: "t", body: ["short"] }));
    const widths = new Set(lines.map((line) => line.length));

    expect(widths.size).toBe(1);
  });

  it("word-wraps long body lines with a hanging bullet indent", () => {
    const long =
      "- " +
      "word ".repeat(30).trim() +
      " and this bullet keeps wrapping well past the card's maximum width";

    const lines = plain(card({ title: "t", body: [long] }));
    const bodyLines = lines.slice(1, -1);
    const wrapped = bodyLines.filter((line) => line.includes("word"));

    expect(wrapped.length).toBeGreaterThan(1);
    expect(wrapped[1]).toMatch(/^\s*│ {3}\w/);
  });

  it("widens for a long attribute instead of breaking its wall", () => {
    const deep = "src/" + "nested/".repeat(12) + "file.ts";
    const lines = plain(card({ title: "t", attrs: [["file", deep]] }));
    const widths = new Set(lines.map((line) => line.length));

    expect(widths.size).toBe(1);
    expect(lines[1]).toContain(deep);
  });
});
