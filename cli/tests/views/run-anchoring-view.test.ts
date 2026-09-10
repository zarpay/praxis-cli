import { describe, expect, it } from "vitest";

import runAnchoringView from "@/views/run-anchoring-view.js";
import { reportText } from "@tests/helpers/report-text.js";

describe("runAnchoringView", () => {
  it("says nothing for an anchored run — the sha is the evidence", () => {
    const lines = runAnchoringView({ inRepo: true, commitSha: "a".repeat(40), branch: "main" });

    expect(lines).toEqual([]);
  });

  it("says nothing outside a repo — there is nothing to anchor to", () => {
    const lines = runAnchoringView({ inRepo: false, commitSha: null, branch: null });

    expect(lines).toEqual([]);
  });

  it("names the evidence grade for an unanchored run in a repo", () => {
    const lines = runAnchoringView({ inRepo: true, commitSha: null, branch: "main" });
    const text = reportText(lines);

    expect(text).toContain("[WARN]");
    expect(text).toContain("feedback, not measurement");
    expect(text).toContain("Commit first");
  });
});
