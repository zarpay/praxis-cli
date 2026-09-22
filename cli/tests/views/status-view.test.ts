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
    evalState: {
      awaiting_curation: 0,
      pending_triage: 0,
      calibration_stale: true,
      epoch_boundary_detected: false,
      last_run_at: null,
    },
    issueCount: 0,
    orphanedPractices: [],
    danglingRefs: [],
    expertsMissingDescription: [],
    invalidExperts: [],
    zeroMatchGlobs: [],
    coverage: {
      sourceFiles: 5,
      observed: { files: 4, rate: 0.8, display: "80% (4/5 files)" },
      passing: { files: 3, rate: 0.6, display: "60% (3/5 files)" },
    },
    ...fields,
  };
}

/** A reviewer tally, defaulting every bucket to zero. */
function tally(fields: Partial<StatusReport["validation"][number]>) {
  return { reviewer: "flash", pass: 0, warn: 0, fail: 0, notValidated: 0, ...fields };
}

describe("document counts", () => {
  it("renders the counts as an outlined table, one row per document type", () => {
    const text = reportText(
      statusView(report({ counts: { experts: 3, practices: 7, references: 1, context: 2 } })),
    );

    expect(text).toMatch(/DOCUMENTS\s*│\s*COUNT/);
    expect(text).toMatch(/Experts\s*│\s*3/);
    expect(text).toMatch(/Practices\s*│\s*7/);
    expect(text).toMatch(/References\s*│\s*1/);
    expect(text).toMatch(/Context files\s*│\s*2/);
  });
});

describe("review state", () => {
  /** The rendered report for the given validation rows. */
  function rendered(validation: StatusReport["validation"]): string {
    return reportText(statusView(report({ validation })));
  }

  it("renders coverage as a table — observed and passing rows, counts and rates", () => {
    const text = reportText(statusView(report()));

    expect(text).toMatch(/COVERAGE\s*│\s*FILES\s*│\s*RATE/);
    expect(text).toMatch(/Observed\s*│\s*4\/5\s*│\s*80%/);
    expect(text).toMatch(/Passing\s*│\s*3\/5\s*│\s*60%/);
  });

  it("renders one table row per reviewer that has reviewed something", () => {
    const text = rendered([tally({ reviewer: "flash", pass: 2 }), tally({ reviewer: "v32" })]);

    expect(text).toMatch(/flash\s*│\s*2/);
    expect(text).not.toContain("v32");
  });

  it("keeps a reviewer whose only verdicts are failures", () => {
    expect(rendered([tally({ reviewer: "flash", fail: 1 })])).toContain("flash");
  });

  it("keeps a reviewer with nothing but unvalidated targets", () => {
    expect(rendered([tally({ reviewer: "flash", notValidated: 4 })])).toContain("flash");
  });

  it("labels the nameless reader when no reviewer is configured", () => {
    expect(rendered([tally({ reviewer: null, notValidated: 3 })])).toContain("none configured");
  });

  it("carries the four buckets as columns in a fixed order", () => {
    const text = rendered([tally({ pass: 1, warn: 2, fail: 3, notValidated: 4 })]);

    expect(text).toMatch(/REVIEWER\s*│\s*PASS\s*│\s*WARN\s*│\s*FAIL\s*│\s*NOT VALIDATED/);
    expect(text).toMatch(/flash\s*│\s*1\s*│\s*2\s*│\s*3\s*│\s*4/);
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

  it("closes with the report's own issueCount — the exit-code fact, never recomputed", () => {
    const text = rendered({
      issueCount: 3,
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
    const lines = statusView(report({ issueCount: 2, orphanedPractices: ["a.md", "b.md"] }));

    expect(lines.at(-1)).toEqual({ channel: "heading", text: "2 issue(s) found" });
  });

  it("counts a malformed expert in the closing line, matching the exit code", () => {
    const lines = statusView(
      report({ issueCount: 1, invalidExperts: [{ expert: "broken.md", reason: "missing alias" }] }),
    );

    expect(lines.at(-1)).toEqual({ channel: "heading", text: "1 issue(s) found" });
  });

  it("omits counts and findings for an eval-only project, keeping the poll facts", () => {
    const lines = statusView(report({ compilerInUse: false }));
    const text = reportText(lines);

    expect(text).toContain("Praxis Project Status");
    expect(text).toContain("Last run: never");
    expect(text).not.toContain("Experts");
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
    ).toContain("Validation");
    expect(lines.some((line) => line.channel === "content")).toBe(true);
  });

  it("introduces each findings block with a warning, then its items", () => {
    const seen = channels(report({ orphanedPractices: ["stray.md"] }));

    expect(seen).toContain("warning");
    expect(seen.indexOf("warning")).toBeLessThan(seen.lastIndexOf("content"));
  });
});
