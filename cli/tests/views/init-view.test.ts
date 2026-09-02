import { describe, expect, it } from "vitest";

import initView from "@/views/init-view.js";

describe("initView", () => {
  const lines = initView({
    created: [".praxis/config.json", "experts/README.md", "experts/stewart.md"],
    skipped: 1,
    nextSteps: ["  1. Edit config"],
  });

  it("confirms each created file on its own line", () => {
    expect(lines).toContainEqual({ channel: "success", text: "Created .praxis/config.json" });
    expect(lines).toContainEqual({ channel: "success", text: "Created experts/stewart.md" });
  });

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
