import type { Verdict } from "@/types.js";

import { describe, expect, it } from "vitest";

import buildReviewedTargetService from "@/services/build-reviewed-target-service.js";
import { testConfig } from "@tests/helpers/test-config.js";

const cfg = testConfig("/tmp/praxis-build-reviewed-target");

/** A verdict carrying only what the summary reads. */
function verdict(fields: Partial<Verdict>): Verdict {
  return { compliant: true, severity: "error", issues: [], reason: "", ...fields };
}

/** One reviewer's opinion, for the verdict list. */
function said(reviewerName: string, fields: Partial<Verdict>) {
  return { reviewerName, verdict: verdict(fields) };
}

/** A critique as a reviewer returns it. */
function issue(text: string) {
  return { text, axiomId: null, axiomVersion: null };
}

describe("buildReviewedTargetService", () => {
  it("is null when nothing looked at the target", () => {
    const built = buildReviewedTargetService(cfg, { path: "src/a.ts", verdicts: [] });

    expect(built).toBeNull();
  });

  it("takes the most serious verdict, not a consensus — one error outranks two passes", () => {
    const built = buildReviewedTargetService(cfg, {
      path: "src/a.ts",
      verdicts: [
        said("one", { compliant: true }),
        said("two", { compliant: false, severity: "error", issues: [issue("broken")] }),
        said("three", { compliant: true }),
      ],
    });

    expect(built?.verdict.compliant).toBe(false);
    expect(built?.verdict.severity).toBe("error");
  });

  it("ranks a warning above a pass and below an error", () => {
    const warned = buildReviewedTargetService(cfg, {
      path: "src/a.ts",
      verdicts: [
        said("one", { compliant: true }),
        said("two", { compliant: false, severity: "warning" }),
      ],
    });

    expect(warned?.verdict.severity).toBe("warning");
  });

  it("treats a compliant verdict as lowest whatever severity it carries", () => {
    // severity only describes a failure; a pass that names one is still a pass.
    const built = buildReviewedTargetService(cfg, {
      path: "src/a.ts",
      verdicts: [
        said("one", { compliant: true, severity: "error" }),
        said("two", { compliant: false, severity: "warning" }),
      ],
    });

    expect(built?.verdict.compliant).toBe(false);
  });

  it("folds identical findings into one, counting who said it", () => {
    const built = buildReviewedTargetService(cfg, {
      path: "src/a.ts",
      verdicts: [
        said("one", { compliant: false, severity: "error", issues: [issue("same words")] }),
        said("two", { compliant: false, severity: "error", issues: [issue("same words")] }),
      ],
    });

    expect(built?.findings).toHaveLength(1);
    expect(built?.findings[0]?.witnesses).toEqual(["one", "two"]);
  });

  it("keeps near-duplicates separate — identity is the exact text until triage labels them", () => {
    const built = buildReviewedTargetService(cfg, {
      path: "src/a.ts",
      verdicts: [
        said("one", { compliant: false, severity: "error", issues: [issue("a"), issue("a.")] }),
      ],
    });

    expect(built?.findings).toHaveLength(2);
  });

  it("never lists one reviewer twice as a witness to the same finding", () => {
    const built = buildReviewedTargetService(cfg, {
      path: "src/a.ts",
      verdicts: [
        said("one", {
          compliant: false,
          severity: "error",
          issues: [issue("twice"), issue("twice")],
        }),
      ],
    });

    expect(built?.findings[0]?.witnesses).toEqual(["one"]);
  });

  it("carries the path and the reviewer count through untouched", () => {
    const built = buildReviewedTargetService(cfg, {
      path: "src/services/checkout.ts",
      verdicts: [said("one", { compliant: true }), said("two", { compliant: true })],
    });

    expect(built?.path).toBe("src/services/checkout.ts");
    expect(built?.reviewerCount).toBe(2);
  });
});
