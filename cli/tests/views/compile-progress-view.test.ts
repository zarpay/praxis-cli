import { describe, expect, it } from "vitest";

import compileProgressView from "@/views/compile-progress-view.js";

describe("compileProgressView", () => {
  it("names the profile path that was written, not a filename guessed from the alias", () => {
    const [line] = compileProgressView({
      kind: "compiled",
      alias: "Scooper",
      output: "agent-profiles/scooper.expert.md",
    });

    expect(line).toEqual({ channel: "success", text: "Compiled agent-profiles/scooper.expert.md" });
  });

  it("says when only plugin output exists rather than naming a file that is not there", () => {
    const [line] = compileProgressView({ kind: "compiled", alias: "Scooper", output: null });

    expect(line).toEqual({ channel: "success", text: "Compiled Scooper (plugin output only)" });
  });

  it("reports a skipped expert with its reason", () => {
    const [line] = compileProgressView({ kind: "skipped", file: "bad.md", reason: "no alias" });

    expect(line).toEqual({ channel: "warning", text: "Skipping bad.md: no alias" });
  });
});
