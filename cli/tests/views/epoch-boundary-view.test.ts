import type { EpochBoundary } from "@/types.js";

import { describe, expect, it } from "vitest";

import epochBoundaryView from "@/views/epoch-boundary-view.js";
import { reportText } from "@tests/helpers/report-text.js";

/** A boundary whose fields tests override one at a time. */
function boundary(overrides: Partial<EpochBoundary> = {}): EpochBoundary {
  return {
    reviewerName: "flash",
    currentHash: "aaaa1111",
    currentModel: "some/model",
    previousHash: "bbbb2222",
    previousModel: "some/model",
    lastRunTimestamp: "2026-09-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("epochBoundaryView", () => {
  it("renders nothing when there is no boundary", () => {
    const lines = epochBoundaryView([]);

    expect(lines).toEqual([]);
  });

  it("names a model change as the cause", () => {
    const changed = boundary({ currentModel: "new/model", previousModel: "old/model" });

    const lines = epochBoundaryView([changed]);
    const warning = lines[0];
    const warningText = warning.channel === "warning" ? warning.text : "";

    expect(warning.channel).toBe("warning");
    expect(warningText).toContain("model → new/model");
    expect(warningText).toContain('reviewer "flash"');
    expect(warningText).toContain("2026-09-01");
  });

  it("points a same-model change at config or prompt surface", () => {
    const lines = epochBoundaryView([boundary()]);
    const warning = lines[0];
    const warningText = warning.channel === "warning" ? warning.text : "";

    expect(warningText).toContain("config or prompt surface");
  });

  it("recommends the re-baseline after the warnings", () => {
    const boundaries = [boundary(), boundary({ reviewerName: "v32" })];

    const lines = epochBoundaryView(boundaries);
    const recommendation = lines[lines.length - 1];
    const recommendationText = reportText([recommendation]);

    expect(lines).toHaveLength(5);
    expect(recommendation.channel).toBe("content");
    expect(recommendationText).toContain("praxis eval run");
  });
});
