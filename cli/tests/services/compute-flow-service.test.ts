import type { Critique, FlowSide } from "@/types.js";

import { describe, expect, it } from "vitest";

import computeFlowService from "@/services/compute-flow-service.js";
import { testConfig } from "@tests/helpers/test-config.js";

const CFG = testConfig("/project");

/** A matched critique of the given axiom. */
function matched(axiomId: string, text = "violation"): Critique {
  return { text, axiomId, axiomVersion: 1 };
}

/** An open-channel critique — no axiom identity to diff on. */
function open(text: string): Critique {
  return { text, axiomId: null, axiomVersion: null };
}

/** One side under the shared default provenance. */
function side(
  issues: Critique[],
  provenance = { spec: "spec1234", reviewer: "rev-5678" },
): FlowSide {
  return { issues, specContentHash: provenance.spec, reviewerHash: provenance.reviewer };
}

describe("computeFlowService", () => {
  it("labels by set-difference: after-only introduced, both inherited, before-only resolved", () => {
    const result = computeFlowService(CFG, {
      before: side([matched("AX-aaaa11"), matched("AX-bbbb22")]),
      after: side([matched("AX-bbbb22"), matched("AX-cccc33")]),
    });

    expect(result.afterFlow).toEqual(["inherited", "introduced"]);
    expect(result.resolved.map((critique) => critique.axiomId)).toEqual(["AX-aaaa11"]);
    expect(result.refused).toBe(false);
  });

  it("gives open-channel critiques no label and never resolves them", () => {
    const result = computeFlowService(CFG, {
      before: side([open("was here, prose only")]),
      after: side([open("something else entirely")]),
    });

    expect(result.afterFlow).toEqual([null]);
    expect(result.resolved).toEqual([]);
  });

  it("an added file introduces every matched critique", () => {
    const result = computeFlowService(CFG, {
      before: null,
      after: side([matched("AX-aaaa11"), open("raw")]),
    });

    expect(result.afterFlow).toEqual(["introduced", null]);
    expect(result.resolved).toEqual([]);
  });

  it("a deleted file resolves every matched critique", () => {
    const result = computeFlowService(CFG, {
      before: side([matched("AX-aaaa11"), open("raw")]),
      after: null,
    });

    expect(result.afterFlow).toEqual([]);
    expect(result.resolved.map((critique) => critique.axiomId)).toEqual(["AX-aaaa11"]);
  });

  it("two same-axiom critiques share one identity — inherited wins over introduced", () => {
    const result = computeFlowService(CFG, {
      before: side([matched("AX-aaaa11", "old instance")]),
      after: side([matched("AX-aaaa11", "old instance"), matched("AX-aaaa11", "second instance")]),
    });

    expect(result.afterFlow).toEqual(["inherited", "inherited"]);
    expect(result.resolved).toEqual([]);
  });

  it("refuses a comparison across provenance — variance must not masquerade as flow (01)", () => {
    const result = computeFlowService(CFG, {
      before: side([matched("AX-aaaa11")], { spec: "old-spec", reviewer: "rev-5678" }),
      after: side([matched("AX-bbbb22")]),
    });

    expect(result.refused).toBe(true);
    expect(result.afterFlow).toEqual([null]);
    expect(result.resolved).toEqual([]);
  });
});
