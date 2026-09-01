import type { Verdict } from "@/types.js";

import chalk from "chalk";
import { describe, expect, it } from "vitest";

import { unitHeading, verdictMark } from "@/domains/eval/orchestrators/eval-run.js";

/** Strips ANSI colour so assertions read as plain text. */
function plain(text: string): string {
  return text.replace(
    // eslint-disable-next-line no-control-regex -- matching the escape sequences is the point
    /\x1B\[[0-9;]*m/g,
    "",
  );
}

/** Builds a verdict with only the fields the mark depends on. */
function verdict(fields: Partial<Verdict>): Verdict {
  return { compliant: true, severity: "error", issues: [], reason: "", ...fields };
}

describe("unitHeading", () => {
  it("shows the counter and filename for a plain single-judge unit", () => {
    const heading = plain(unitHeading({ index: 2, total: 7, path: "/p/src/awards.ts" }));

    expect(heading).toBe("[2/7] awards.ts");
  });

  it("labels a cohort with its member count", () => {
    const heading = plain(
      unitHeading({ index: 1, total: 3, path: "/p/src/features/loyalty", cohortSize: 4 }),
    );

    expect(heading).toBe("[1/3] loyalty (cohort · 4 files)");
  });

  it("names the judge when more than one is running", () => {
    const heading = plain(unitHeading({ index: 1, total: 1, path: "/p/a.ts", judgeName: "flash" }));

    expect(heading).toBe("[1/1] a.ts [judge: flash]");
  });

  it("carries both labels at once, cohort before judge", () => {
    const heading = plain(
      unitHeading({ index: 5, total: 5, path: "/p/dir", cohortSize: 2, judgeName: "v32" }),
    );

    expect(heading).toBe("[5/5] dir (cohort · 2 files) [judge: v32]");
  });

  it("omits the cohort label for a one-file cohort size of zero", () => {
    const heading = plain(unitHeading({ index: 1, total: 1, path: "/p/a.ts", cohortSize: 0 }));

    expect(heading).toBe("[1/1] a.ts");
  });
});

describe("verdictMark", () => {
  it("marks a compliant verdict as PASS in green", () => {
    const mark = verdictMark(verdict({ compliant: true }));

    expect(mark).toBe(chalk.green("✓ PASS"));
  });

  it("marks a non-compliant warning as WARN in yellow", () => {
    const mark = verdictMark(verdict({ compliant: false, severity: "warning" }));

    expect(mark).toBe(chalk.yellow("⚠ WARN"));
  });

  it("marks a non-compliant error as FAIL in red", () => {
    const mark = verdictMark(verdict({ compliant: false, severity: "error" }));

    expect(mark).toBe(chalk.red("✗ FAIL"));
  });
});
