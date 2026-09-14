import type { LabelProgressEvent } from "@/types.js";

import { describe, expect, it } from "vitest";

import labelProgressView from "@/views/label-progress-view.js";
import { printableWidth } from "@framework/views/palette.js";
import { reportText } from "@tests/helpers/report-text.js";

/** One labeling event, with only the fields the card shows. */
function event(overrides: Partial<LabelProgressEvent> = {}): LabelProgressEvent {
  return {
    done: 3,
    total: 12,
    critiqueId: "20260907T101932101Z-c0f5baa5:6",
    filePath: "src/services/redeem-coupon.ts",
    text: "Error message 'bad input' tells the consumer nothing about what was wrong.",
    outcome: "labeled",
    axiomId: "AX-b951db",
    ...overrides,
  };
}

/** The rendered card as plain lines. */
function lines(overrides: Partial<LabelProgressEvent> = {}): string[] {
  return reportText(labelProgressView(event(overrides))).split("\n");
}

describe("labelProgressView", () => {
  it("frames the critique with its counter, file and words", () => {
    const rendered = lines().join("\n");

    expect(rendered).toContain("[3/12] critique 20260907T101932101Z-c0f5baa5:6");
    expect(rendered).toContain("src/services/redeem-coupon.ts");
    expect(rendered).toContain("Error message 'bad input' tells the consumer");
  });

  it("names the axiom a labeled critique landed under", () => {
    expect(lines().join("\n")).toContain("AX-b951db");
  });

  it("sends an unmatched critique to curate", () => {
    const rendered = lines({ outcome: "unmatched", axiomId: null }).join("\n");

    expect(rendered).toContain("no match");
    expect(rendered).toContain("goes to curate");
  });

  it("says a failed call stays untriaged, and how to retry", () => {
    const rendered = lines({ outcome: "failed", axiomId: null }).join("\n");

    expect(rendered).toContain("call failed");
    expect(rendered).toContain("rerun triage to retry");
  });

  it("wraps long words rather than eliding them, and stays in the terminal", () => {
    const long =
      "The happy path begins before the parlor id is validated, so a malformed request " +
      "reaches the ranking logic before anything rejects it, and the failure surfaces far " +
      "from its cause with no indication of what the caller actually got wrong.";
    const rendered = lines({ text: long });
    const widths = new Set(rendered.filter(Boolean).map((line) => printableWidth(line)));

    const carried = rendered
      .map((line) => line.replace(/^\s*│ | │$/g, ""))
      .join(" ")
      .replace(/\s+/g, " ");

    expect(widths.size).toBe(1);
    expect([...widths][0]).toBeLessThanOrEqual(80);
    // Elision used to cut at 120 characters; the card carries the whole thing.
    expect(carried).toContain(long);
  });

  it("keeps a deep path inside the frame", () => {
    const rendered = lines({ filePath: `src/features/${"nested/".repeat(12)}service.ts` });
    const widths = new Set(rendered.filter(Boolean).map((line) => printableWidth(line)));

    expect(widths.size).toBe(1);
  });
});
