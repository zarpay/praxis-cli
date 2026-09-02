import type { EvalProgress, Verdict } from "@/types.js";

import { describe, expect, it } from "vitest";

import runProgressView from "@/views/run-progress-view.js";
import { reportText } from "@tests/helpers/report-text.js";

/** Strips ANSI colour so assertions read as plain text. */
function plain(text: string): string {
  return text.replace(
    // eslint-disable-next-line no-control-regex -- matching the escape sequences is the point
    /\x1B\[[0-9;]*m/g,
    "",
  );
}

/** The rendered event as plain searchable text. */
function rendered(event: EvalProgress): string {
  return plain(reportText(runProgressView(event)));
}

/** Builds a verdict with only the fields the mark depends on. */
function verdict(fields: Partial<Verdict>): Verdict {
  return { compliant: true, severity: "error", issues: [], reason: "", ...fields };
}

describe("a unit starting", () => {
  it("shows the counter and filename for a plain single-reviewer unit", () => {
    const text = rendered({ kind: "unit-start", index: 2, total: 7, path: "/p/src/awards.ts" });

    expect(text).toContain("[2/7] awards.ts");
  });

  it("labels a cohort with its member count", () => {
    const text = rendered({
      kind: "unit-start",
      index: 1,
      total: 3,
      path: "/p/src/features/loyalty",
      cohortSize: 4,
    });

    expect(text).toContain("[1/3] loyalty (cohort · 4 files)");
  });

  it("names the reviewer when more than one is running", () => {
    const text = rendered({
      kind: "unit-start",
      index: 1,
      total: 1,
      path: "/p/a.ts",
      reviewerName: "flash",
    });

    expect(text).toContain("[1/1] a.ts [reviewer: flash]");
  });

  it("carries both labels at once, cohort before reviewer", () => {
    const text = rendered({
      kind: "unit-start",
      index: 5,
      total: 5,
      path: "/p/dir",
      cohortSize: 2,
      reviewerName: "v32",
    });

    expect(text).toContain("[5/5] dir (cohort · 2 files) [reviewer: v32]");
  });
});

describe("a verdict landing", () => {
  it("marks a compliant verdict as PASS", () => {
    expect(rendered({ kind: "verdict", verdict: verdict({ compliant: true }) })).toContain(
      "✓ PASS",
    );
  });

  it("marks a non-compliant warning as WARN", () => {
    const text = rendered({
      kind: "verdict",
      verdict: verdict({ compliant: false, severity: "warning" }),
    });

    expect(text).toContain("⚠ WARN");
  });

  it("marks a non-compliant error as FAIL, listing its issues", () => {
    const text = rendered({
      kind: "verdict",
      verdict: verdict({
        compliant: false,
        severity: "error",
        issues: [{ text: "Missing title", axiomId: null, axiomVersion: null }],
      }),
    });

    expect(text).toContain("✗ FAIL");
    expect(text).toContain("· Missing title");
  });
});

describe("a unit that could not be reviewed", () => {
  it("marks it unverified — never a violation — with the reason", () => {
    const text = rendered({ kind: "unit-error", message: "spec unreadable" });

    expect(text).toContain("✗ UNVERIFIED");
    expect(text).toContain("· spec unreadable");
  });
});
