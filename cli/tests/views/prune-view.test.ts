import { describe, expect, it } from "vitest";

import pruneView from "@/views/prune-view.js";

describe("pruneView", () => {
  it("celebrates a cache with nothing stale", () => {
    expect(pruneView({ entriesPruned: 0, filesRemoved: 0 })).toEqual([
      { channel: "success", text: "Nothing to prune — every cached verdict is current" },
    ]);
  });

  it("reports what fell", () => {
    expect(pruneView({ entriesPruned: 5, filesRemoved: 2 })).toEqual([
      { channel: "success", text: "Pruned 5 stale verdict(s); removed 2 cache file(s)" },
    ]);
  });
});
