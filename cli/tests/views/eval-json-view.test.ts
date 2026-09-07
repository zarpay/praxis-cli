import type { ReviewedTarget } from "@/types.js";

import { describe, expect, it } from "vitest";

import evalJsonView from "@/views/eval-json-view.js";
import { reportText } from "@tests/helpers/report-text.js";

function parse(lines: ReturnType<typeof evalJsonView>): Record<string, unknown> {
  return JSON.parse(reportText(lines)) as Record<string, unknown>;
}

const REVIEWED: ReviewedTarget = {
  path: "src/services/cancel-order.ts",
  verdict: { compliant: false, issues: [], reason: "vague error", severity: "error" },
  findings: [
    {
      axiomId: "AX-b951db",
      text: "Error messages must be specific…",
      severity: "error",
      witnesses: ["v32", "flash"],
    },
    { axiomId: null, text: "the happy path is nested", severity: "warning", witnesses: ["v32"] },
  ],
  reviewerCount: 2,
};

describe("evalJsonView", () => {
  it("targets mode carries the match-state contract (08-d)", () => {
    const payload = parse(evalJsonView({ kind: "targets", targets: [REVIEWED] }));
    const targets = payload["targets"] as Record<string, unknown>[];
    const findings = targets[0]["findings"] as Record<string, unknown>[];

    expect(payload["mode"]).toBe("targets");
    expect(targets[0]["status"]).toBe("fail");
    expect(findings[0]).toMatchObject({
      axiom_id: "AX-b951db",
      channel: "matched",
      witnesses: ["v32", "flash"],
    });
    expect(findings[1]).toMatchObject({ axiom_id: null, channel: "open" });
  });

  it("an unverified target says so instead of passing silently", () => {
    const unverified: ReviewedTarget = {
      ...REVIEWED,
      verdict: {
        compliant: false,
        unverified: true,
        issues: [],
        reason: "provider failed",
      } as ReviewedTarget["verdict"] & { unverified: true },
      findings: [],
    };
    const payload = parse(evalJsonView({ kind: "targets", targets: [unverified] }));
    const targets = payload["targets"] as Record<string, unknown>[];

    expect(targets[0]["status"]).toBe("unverified");
  });

  it("corpus mode is the summary and the cache economics", () => {
    const payload = parse(
      evalJsonView({
        kind: "corpus",
        summary: {
          total: 26,
          compliant: 18,
          warnings: 0,
          errors: 0,
          unverified: 0,
          notValidated: 8,
          byType: {},
          byReviewer: {},
        },
        cacheStats: { hits: 18, misses: 0 },
      }),
    );

    expect(payload["mode"]).toBe("corpus");
    expect(payload["cache"]).toEqual({ hits: 18, misses: 0 });
  });
});
