import type { Finding, ReviewedTarget, Verdict } from "@/types.js";

import { describe, expect, it } from "vitest";

import reviewedTargetView from "@/views/reviewed-target-view.js";
import { reportText } from "@tests/helpers/report-text.js";

/** Strips ANSI colour so assertions read as plain text. */
function plain(text: string): string {
  return text.replace(
    // eslint-disable-next-line no-control-regex -- matching the escape sequences is the point
    /\x1B\[[0-9;]*m/g,
    "",
  );
}

/** The rendered target as plain searchable text. */
function rendered(target: ReviewedTarget): string {
  return plain(reportText(reviewedTargetView(target)));
}

/** Builds a verdict with only the fields the badge depends on. */
function verdict(fields: Partial<Verdict>): Verdict {
  return { compliant: true, severity: "error", issues: [], reason: "", ...fields };
}

/** Builds a finding with only the fields the line depends on. */
function finding(fields: Partial<Finding>): Finding {
  return { text: "", axiomId: null, severity: "error", witnesses: ["flash"], ...fields };
}

describe("a reviewed target", () => {
  it("names the target by its whole path, not its filename alone", () => {
    const text = rendered({
      path: "src/services/redeem-coupon.ts",
      verdict: verdict({ compliant: true }),
      findings: [],
      reviewerCount: 1,
    });

    expect(text).toContain("[PASS] src/services/redeem-coupon.ts");
  });

  it("renders a bare filename with no directory prefix", () => {
    const text = rendered({
      path: "README.md",
      verdict: verdict({ compliant: true }),
      findings: [],
      reviewerCount: 1,
    });

    expect(text).toContain("[PASS] README.md");
  });

  it("badges a warning verdict and lists its findings", () => {
    const text = rendered({
      path: "src/services/rank-parlors.ts",
      verdict: verdict({ compliant: false, severity: "warning" }),
      findings: [finding({ text: "The happy path begins before validation." })],
      reviewerCount: 1,
    });

    expect(text).toContain("[WARN] src/services/rank-parlors.ts");
    expect(text).toContain("- The happy path begins before validation.");
  });

  it("badges an error verdict as FAIL", () => {
    const text = rendered({
      path: "src/services/checkout.ts",
      verdict: verdict({ compliant: false, severity: "error" }),
      findings: [],
      reviewerCount: 1,
    });

    expect(text).toContain("[FAIL] src/services/checkout.ts");
  });

  it("counts witnesses when more than one reviewer looked", () => {
    const text = rendered({
      path: "src/services/checkout.ts",
      verdict: verdict({ compliant: false, severity: "error" }),
      findings: [finding({ text: "Error message says nothing.", witnesses: ["flash", "v32"] })],
      reviewerCount: 2,
    });

    expect(text).toContain("(2/2 reviewers)");
  });

  it("appends the reasoning only when verbose", () => {
    const target: ReviewedTarget = {
      path: "src/services/checkout.ts",
      verdict: verdict({ compliant: true, reason: "Follows the spec throughout." }),
      findings: [],
      reviewerCount: 1,
    };

    expect(rendered(target)).not.toContain("Reasoning:");
    expect(rendered({ ...target, verbose: true })).toContain("Follows the spec throughout.");
  });
});
