import { describe, expect, it } from "vitest";

import initView from "@/views/init-view.js";

describe("initView", () => {
  const lines = initView({ created: 3, skipped: 1, nextSteps: ["  1. Edit config"] });

  it("headlines what was created and what already existed", () => {
    expect(lines).toContainEqual({
      channel: "heading",
      text: "Initialized Praxis project: 3 files created, 1 skipped",
    });
  });

  it("carries the next steps as printable content", () => {
    const content = lines.find((line) => line.channel === "content");

    expect(content && "entries" in content && content.entries).toContain("  1. Edit config");
  });
});
