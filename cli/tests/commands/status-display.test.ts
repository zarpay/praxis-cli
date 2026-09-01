import type { StatusReport } from "@/types.js";

import { describe, expect, it } from "vitest";

import { countLines, issueBlocks, validationBlocks } from "@/commands/status.js";

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
    unmatchedOwners: [],
    ...fields,
  };
}

/** A judge tally, defaulting every bucket to zero. */
function tally(fields: Partial<StatusReport["validation"][number]>) {
  return { judge: "flash", pass: 0, warn: 0, fail: 0, notValidated: 0, ...fields };
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
  it("returns one block per judge that has judged something", () => {
    const blocks = validationBlocks([tally({ judge: "flash", pass: 2 }), tally({ judge: "v32" })]);
    const judges = blocks.map((block) => block.judge);

    expect(judges).toEqual(["flash"]);
  });

  it("keeps a judge whose only verdicts are failures", () => {
    const blocks = validationBlocks([tally({ judge: "flash", fail: 1 })]);

    expect(blocks).toHaveLength(1);
  });

  it("keeps a judge with nothing but unvalidated targets", () => {
    const blocks = validationBlocks([tally({ judge: "flash", notValidated: 4 })]);

    expect(blocks).toHaveLength(1);
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

  it("never pools judges into one block", () => {
    const blocks = validationBlocks([
      tally({ judge: "flash", pass: 1 }),
      tally({ judge: "v32", pass: 1 }),
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

  it("formats an unmatched owner with the owner named", () => {
    const blocks = issueBlocks(report({ unmatchedOwners: [{ practice: "p.md", owner: "Ghost" }] }));

    expect(blocks[0].items).toEqual(["p.md (owner: Ghost)"]);
  });

  it("orders blocks so parse failures precede glob and owner findings", () => {
    const blocks = issueBlocks(
      report({
        invalidExperts: [{ expert: "broken.md", reason: "missing alias" }],
        zeroMatchGlobs: [{ expert: "a.md", pattern: "nope-*.md" }],
        unmatchedOwners: [{ practice: "p.md", owner: "Ghost" }],
      }),
    );
    const headings = blocks.map((block) => block.heading);

    expect(headings).toEqual([
      "Experts that failed to parse:",
      "Glob patterns matching zero files:",
      "Practices with unknown owners:",
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
