import { describe, expect, it } from "vitest";

import compileResultView from "@/views/compile-result-view.js";

describe("compileResultView", () => {
  it("reports the full-compile count", () => {
    const [line] = compileResultView({ compiled: 3 });

    expect(line).toEqual({ channel: "heading", text: "Compiled 3 agent(s) (up-to-date)" });
  });

  it("reports one alias's warnings, then the path it wrote", () => {
    const lines = compileResultView({
      alias: "Scooper",
      output: "profiles/scooper.expert.md",
      warnings: ["Glob pattern matched zero files: context/*.md"],
    });

    expect(lines).toEqual([
      { channel: "warning", text: "Glob pattern matched zero files: context/*.md" },
      { channel: "success", text: "Compiled profiles/scooper.expert.md" },
    ]);
  });
});
