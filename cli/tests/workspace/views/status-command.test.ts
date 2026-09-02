import type { StatusReport } from "@/workspace/types.js";

import { describe, expect, it } from "vitest";

import {
  countLines,
  issueBlocks,
  statusReport,
  validationBlocks,
} from "@/workspace/views/status.js";

/** A clean report, with only the fields a test cares about overridden. */
function report(fields: Partial<StatusReport> = {}): StatusReport {
  return {
    compilerInUse: true,
    counts: { experts: 0, practices: 0, references: 0, context: 0 },
    validation: [],
    orphanedPractices: [],
    danglingRefs: [],
    expertsMissingDescription: [],
    invalidExperts: [],
    zeroMatchGlobs: [],
    ...fields,
  };
}

/** A reviewer tally, defaulting every bucket to zero. */
function tally(fields: Partial<StatusReport["validation"][number]>) {
  return { reviewer: "flash", pass: 0, warn: 0, fail: 0, notValidated: 0, ...fields };
}

describe("countLines", () => {
  it("renders one aligned line per document type", () => {
    const lines = countLines({ experts: 3, practices: 7, references: 1, context: 2 });

    expect(lines).toEqual([
      "  Experts:            3",
      "  Practices:          7",
      "  References:         1",
      "  Context files:      2",
    ]);
  });
});

describe("validationBlocks", () => {
  it("returns one block per reviewer that has reviewed something", () => {
    const blocks = validationBlocks([
      tally({ reviewer: "flash", pass: 2 }),
      tally({ reviewer: "v32" }),
    ]);
    const reviewers = blocks.map((block) => block.reviewer);

    expect(reviewers).toEqual(["flash"]);
  });

  it("keeps a reviewer whose only verdicts are failures", () => {
    const blocks = validationBlocks([tally({ reviewer: "flash", fail: 1 })]);

    expect(blocks).toHaveLength(1);
  });

  it("keeps a reviewer with nothing but unvalidated targets", () => {
    const blocks = validationBlocks([tally({ reviewer: "flash", notValidated: 4 })]);

    expect(blocks).toHaveLength(1);
  });

  it("labels the nameless reader when no reviewer is configured", () => {
    const blocks = validationBlocks([tally({ reviewer: null, notValidated: 3 })]);

    expect(blocks[0].reviewer).toBe("none configured");
  });

  it("carries the four buckets as badges in a fixed order", () => {
    const blocks = validationBlocks([tally({ pass: 1, warn: 2, fail: 3, notValidated: 4 })]);
    const badges = blocks[0].badges.map((badge) => [badge.badge, badge.value]);

    expect(badges).toEqual([
      ["PASS", 1],
      ["WARN", 2],
      ["FAIL", 3],
      ["NOT VALIDATED", 4],
    ]);
  });

  it("never pools reviewers into one block", () => {
    const blocks = validationBlocks([
      tally({ reviewer: "flash", pass: 1 }),
      tally({ reviewer: "v32", pass: 1 }),
    ]);

    expect(blocks).toHaveLength(2);
  });
});

describe("issueBlocks", () => {
  it("returns nothing for a clean report", () => {
    const blocks = issueBlocks(report());

    expect(blocks).toEqual([]);
  });

  it("drops every block that has no findings", () => {
    const blocks = issueBlocks(report({ orphanedPractices: ["stray.md"] }));
    const headings = blocks.map((block) => block.heading);

    expect(headings).toEqual(["Orphaned practices (not referenced by any expert):"]);
  });

  it("formats a dangling reference as expert → ref", () => {
    const blocks = issueBlocks(report({ danglingRefs: [{ expert: "a.md", ref: "gone.md" }] }));

    expect(blocks[0].items).toEqual(["a.md → gone.md"]);
  });

  it("formats an invalid expert with its reason", () => {
    const blocks = issueBlocks(
      report({ invalidExperts: [{ expert: "broken.md", reason: "missing alias" }] }),
    );

    expect(blocks[0].items).toEqual(["broken.md: missing alias"]);
  });

  it("orders blocks so parse failures precede glob findings", () => {
    const blocks = issueBlocks(
      report({
        invalidExperts: [{ expert: "broken.md", reason: "missing alias" }],
        zeroMatchGlobs: [{ expert: "a.md", pattern: "nope-*.md" }],
      }),
    );
    const headings = blocks.map((block) => block.heading);

    expect(headings).toEqual([
      "Experts that failed to parse:",
      "Glob patterns matching zero files:",
    ]);
  });

  it("counts findings as the sum of every block's items", () => {
    const blocks = issueBlocks(
      report({
        orphanedPractices: ["a.md", "b.md"],
        expertsMissingDescription: ["c.md"],
      }),
    );
    const total = blocks.reduce((sum, block) => sum + block.items.length, 0);

    expect(total).toBe(3);
  });
});

describe("statusReport", () => {
  /** The channels a report emits, in order. */
  function channels(report: StatusReport): string[] {
    return statusReport(report).map((line) => line.channel);
  }

  /** Every heading and warning text in a report, in order. */
  function headings(report: StatusReport): string[] {
    return statusReport(report)
      .filter((line) => line.channel === "heading" || line.channel === "warning")
      .map((line) => (line as { text: string }).text);
  }

  it("opens with the title", () => {
    expect(headings(report())[0]).toBe("Praxis Project Status");
  });

  it("closes with success when nothing is wrong", () => {
    const lines = statusReport(report());

    expect(lines.at(-1)).toEqual({ channel: "success", text: "No issues found" });
  });

  it("closes with the count when something is", () => {
    const lines = statusReport(report({ orphanedPractices: ["a.md", "b.md"] }));

    expect(lines.at(-1)).toEqual({ channel: "heading", text: "2 issue(s) found" });
  });

  it("counts a malformed expert in the closing line, matching the exit code", () => {
    const lines = statusReport(
      report({ invalidExperts: [{ expert: "broken.md", reason: "missing alias" }] }),
    );

    expect(lines.at(-1)).toEqual({ channel: "heading", text: "1 issue(s) found" });
  });

  it("omits counts and findings for an eval-only project", () => {
    const lines = statusReport(report({ compilerInUse: false }));

    expect(lines).toEqual([{ channel: "heading", text: "Praxis Project Status" }]);
  });

  it("still reports review state for an eval-only project", () => {
    const lines = statusReport(
      report({ compilerInUse: false, validation: [tally({ reviewer: "flash", pass: 2 })] }),
    );

    expect(
      headings({
        ...report(),
        compilerInUse: false,
        validation: [tally({ reviewer: "flash", pass: 2 })],
      }),
    ).toContain("Validation (reviewer: flash)");
    expect(lines.some((line) => line.channel === "content")).toBe(true);
  });

  it("introduces each findings block with a warning, then its items", () => {
    const seen = channels(report({ orphanedPractices: ["stray.md"] }));

    expect(seen).toContain("warning");
    expect(seen.indexOf("warning")).toBeLessThan(seen.lastIndexOf("content"));
  });
});
