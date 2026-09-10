import { describe, expect, it } from "vitest";

import { frame } from "@framework/views/frame.js";
import { stripAnsi } from "@framework/views/palette.js";

describe("frame", () => {
  it("opens with the bold title and the facts as named cells", () => {
    const lines = frame({
      title: "Eval report",
      facts: [
        ["RUNS", 184],
        ["COST", "$0.13"],
      ],
    }).map((line) => stripAnsi(line));

    expect(lines[0]).toBe("Eval report");
    expect(lines[2]).toMatch(/┌.*┬.*┐/);
    expect(lines[3]).toContain("RUNS");
    expect(lines[3]).toContain("COST");
    expect(lines[5]).toContain("184");
    expect(lines[5]).toContain("$0.13");
  });

  it("is just the title when there are no facts", () => {
    const lines = frame({ title: "Debt report" }).map((line) => stripAnsi(line));

    expect(lines).toEqual(["Debt report"]);
  });
});
