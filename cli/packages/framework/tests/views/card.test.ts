import { describe, expect, it } from "vitest";

import { card } from "@framework/views/card.js";
import { palette, printableWidth, stripAnsi } from "@framework/views/palette.js";

/** Dim text, written literally so the case holds whether or not chalk is on. */
function dim(text: string): string {
  return `\u001b[2m${text}\u001b[22m`;
}

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

  it("wraps a long attribute under its value column instead of widening", () => {
    const deep = "src/" + "nested/".repeat(12) + "file.ts";
    const lines = plain(card({ title: "t", attrs: [["file", deep]], width: 80 }));
    const widths = new Set(lines.map((line) => line.length));
    const carried = lines.slice(1, -1).map((line) => line.replace(/^\s*│ | │$/g, ""));

    expect(widths.size).toBe(1);
    expect([...widths][0]).toBeLessThanOrEqual(80);
    // The whole path survives, split across rows that align under the value.
    expect(carried.join("").replace(/\s+/g, "")).toContain(deep);
    expect(carried[1]).toMatch(/^ {6}\S/);
  });

  it("never draws wider than the width it is given", () => {
    const url = "https://example.com/" + "segment/".repeat(20) + "end";
    const lines = plain(
      card({
        title: "a title long enough to want more room than the card is allowed to take",
        attrs: [["where", url]],
        body: [url, "a normal sentence that wraps the ordinary way when it runs long enough"],
        footer: url,
        width: 60,
      }),
    );
    const widths = new Set(lines.map((line) => line.length));

    expect(widths.size).toBe(1);
    expect([...widths][0]).toBeLessThanOrEqual(60);
  });

  it("breaks an unbreakable token rather than pushing the wall out", () => {
    const url = "https://example.com/" + "segment/".repeat(20) + "end";
    const lines = plain(card({ title: "t", body: [url], width: 80 }));
    const carried = lines.slice(1, -1).map((line) => line.replace(/^\s*│ | │$/g, "").trim());

    expect(carried.length).toBeGreaterThan(1);
    expect(carried.join("")).toBe(url);
  });

  it("truncates a title too long for the frame", () => {
    const title = "a cluster title far longer than this narrow card could ever carry across";
    const lines = plain(card({ title, body: ["short"], width: 60 }));

    expect(lines[0]).toContain("…");
    expect(lines[0].length).toBeLessThanOrEqual(60);
  });

  it("keeps a narrow terminal framed rather than giving up", () => {
    const lines = plain(card({ title: "cluster 1/2", body: ["some words to wrap"], width: 30 }));
    const widths = new Set(lines.map((line) => line.length));

    expect(widths.size).toBe(1);
    expect([...widths][0]).toBeLessThanOrEqual(30);
  });
});

describe("card with styled content", () => {
  it("wraps styled text — chalk being off under test hid this, the terminal did not", () => {
    const text =
      "The happy path begins before the parlor id is validated, so a malformed request reaches the ranking logic before anything rejects it.";
    const lines = card({ title: "cluster 1/2", body: [dim(`  ${text}`)], width: 80 });
    const widths = new Set(lines.map((line) => printableWidth(line)));

    expect(widths.size).toBe(1);
    expect([...widths][0]).toBeLessThanOrEqual(80);
  });

  it("carries the whole text across the wrapped lines, losing nothing", () => {
    const text = "alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike";
    const lines = card({ title: "t", body: [dim(text)], width: 60 });
    const carried = lines
      .slice(1, -1)
      .map((line) =>
        stripAnsi(line)
          .replace(/^\s*│ | │$/g, "")
          .trim(),
      )
      .join(" ");

    expect(carried).toBe(text);
  });

  it("reopens the styling on each wrapped line and closes it at the end", () => {
    const lines = card({ title: "t", body: [dim("word ".repeat(40).trim())], width: 80 });
    const rows = lines.slice(1, -1).filter((line) => stripAnsi(line).includes("word"));

    expect(rows.length).toBeGreaterThan(1);

    for (const row of rows) {
      const content = row.slice(row.indexOf("\u001b[2m"));

      expect(content).toContain("\u001b[2m");
      expect(content).toContain("\u001b[0m");
    }
  });

  it("never lets a style run bleed into the frame", () => {
    const lines = card({ title: "t", body: [palette.quote("x".repeat(200))], width: 80 });
    const last = lines[lines.length - 1] ?? "";

    expect(stripAnsi(last)).toMatch(/╰─+╯$/);
  });

  it("measures a styled attribute by its printable width, not its escape codes", () => {
    const lines = card({
      title: "t",
      attrs: [["where", dim("src/features/loyalty/service.ts")]],
      body: ["short"],
      width: 80,
    });
    const widths = new Set(lines.map((line) => printableWidth(line)));

    expect(widths.size).toBe(1);
  });
});
