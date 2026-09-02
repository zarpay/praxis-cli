import type { StatusReport } from "@/types.js";

import { describe, expect, it } from "vitest";

import statusView from "@/views/status-view.js";
import { reportText } from "@tests/helpers/report-text.js";

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

describe("document counts", () => {
  it("renders one aligned line per document type", () => {
    const text = reportText(
      statusView(report({ counts: { experts: 3, practices: 7, references: 1, context: 2 } })),
    );

    expect(text).toContain("  Experts:            3");
    expect(text).toContain("  Practices:          7");
    expect(text).toContain("  References:         1");
    expect(text).toContain("  Context files:      2");
  });
});

describe("review state", () => {
  /** The rendered report for the given validation rows. */
  function rendered(validation: StatusReport["validation"]): string {
    return reportText(statusView(report({ validation })));
  }

  it("renders one block per reviewer that has reviewed something", () => {
    const text = rendered([tally({ reviewer: "flash", pass: 2 }), tally({ reviewer: "v32" })]);

    expect(text).toContain("Validation (reviewer: flash)");
    expect(text).not.toContain("Validation (reviewer: v32)");
  });

  it("keeps a reviewer whose only verdicts are failures", () => {
    expect(rendered([tally({ reviewer: "flash", fail: 1 })])).toContain("(reviewer: flash)");
  });

  it("keeps a reviewer with nothing but unvalidated targets", () => {
    expect(rendered([tally({ reviewer: "flash", notValidated: 4 })])).toContain(
      "(reviewer: flash)",
    );
  });

  it("labels the nameless reader when no reviewer is configured", () => {
    expect(rendered([tally({ reviewer: null, notValidated: 3 })])).toContain(
      "(reviewer: none configured)",
    );
  });

  it("carries the four buckets in a fixed order", () => {
    const text = rendered([tally({ pass: 1, warn: 2, fail: 3, notValidated: 4 })]);
    const order = ["[PASS] 1", "[WARN] 2", "[FAIL] 3", "[NOT VALIDATED] 4"];

    expect(order.map((mark) => text.indexOf(mark))).toEqual(
      order.map((mark) => text.indexOf(mark)).sort((a, b) => a - b),
    );
    expect(text.indexOf("[PASS] 1")).toBeGreaterThan(-1);
  });
});

describe("findings", () => {
  /** The rendered report as searchable text. */
  function rendered(fields: Partial<StatusReport>): string {
    return reportText(statusView(report(fields)));
  }

  it("reports nothing for a clean report", () => {
    expect(rendered({})).not.toContain("[WARN]");
  });

  it("drops every block that has no findings", () => {
    const text = rendered({ orphanedPractices: ["stray.md"] });

    expect(text).toContain("Orphaned practices (not referenced by any expert):");
    expect(text).not.toContain("Dangling references");
    expect(text).not.toContain("failed to parse");
  });

  it("formats a dangling reference as expert → ref", () => {
    expect(rendered({ danglingRefs: [{ expert: "a.md", ref: "gone.md" }] })).toContain(
      "a.md → gone.md",
    );
  });

  it("formats an invalid expert with its reason", () => {
    expect(
      rendered({ invalidExperts: [{ expert: "broken.md", reason: "missing alias" }] }),
    ).toContain("broken.md: missing alias");
  });

  it("orders blocks so parse failures precede glob findings", () => {
    const text = rendered({
      invalidExperts: [{ expert: "broken.md", reason: "missing alias" }],
      zeroMatchGlobs: [{ expert: "a.md", pattern: "nope-*.md" }],
    });

    expect(text.indexOf("Experts that failed to parse:")).toBeLessThan(
      text.indexOf("Glob patterns matching zero files:"),
    );
  });

  it("counts findings as the sum of every block's items", () => {
    const text = rendered({
      orphanedPractices: ["a.md", "b.md"],
      expertsMissingDescription: ["c.md"],
    });

    expect(text).toContain("3 issue(s) found");
  });
});

describe("the whole report", () => {
  /** The channels a report emits, in order. */
  function channels(report: StatusReport): string[] {
    return statusView(report).map((line) => line.channel);
  }

  /** Every heading and warning text in a report, in order. */
  function headings(report: StatusReport): string[] {
    return statusView(report)
      .filter((line) => line.channel === "heading" || line.channel === "warning")
      .map((line) => (line as { text: string }).text);
  }

  it("opens with the title", () => {
    expect(headings(report())[0]).toBe("Praxis Project Status");
  });

  it("closes with success when nothing is wrong", () => {
    const lines = statusView(report());

    expect(lines.at(-1)).toEqual({ channel: "success", text: "No issues found" });
  });

  it("closes with the count when something is", () => {
    const lines = statusView(report({ orphanedPractices: ["a.md", "b.md"] }));

    expect(lines.at(-1)).toEqual({ channel: "heading", text: "2 issue(s) found" });
  });

  it("counts a malformed expert in the closing line, matching the exit code", () => {
    const lines = statusView(
      report({ invalidExperts: [{ expert: "broken.md", reason: "missing alias" }] }),
    );

    expect(lines.at(-1)).toEqual({ channel: "heading", text: "1 issue(s) found" });
  });

  it("omits counts and findings for an eval-only project", () => {
    const lines = statusView(report({ compilerInUse: false }));

    expect(lines).toEqual([{ channel: "heading", text: "Praxis Project Status" }]);
  });

  it("still reports review state for an eval-only project", () => {
    const lines = statusView(
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
