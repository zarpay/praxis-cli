import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import promptSurface from "@/prompts/prompt-surface.js";

/**
 * The reviewer-facing prompt surface, locked.
 *
 * promptSurface() is the prompt component of every reviewer's behavioral
 * hash: rewording ANY reviewer-facing text — the system prompt, a tool
 * description, the question framing — changes every reviewer's identity
 * and invalidates every cached verdict in every project (a new epoch).
 *
 * That is by design, but it must never happen by accident. If this lock
 * fails, either revert the wording, or update the constant and say in
 * the commit that the epoch roll is intentional.
 */
// Epoch history: 61132753 (v2 pre-axioms) → 0717752e (2026-09-03, the
// two-channel reviewer: axiom checklist + open channel + the judgment-
// boundary posture, 03/04 — the M3 epoch roll, intentional).
// Epoch history: "0717752e" (two-channel checklist surface) →
// "41134ad4" (2026-09-07: review→label — the checklist leaves the
// reviewer entirely; owner's single-channel prompt; issues untagged) →
// "a0c2757a" (2026-09-08: exemplars retired — live code held up as a
// blessed example drifts; the EXEMPLARS section leaves the surface).
const LOCKED_SURFACE_SHA8 = "a0c2757a";

describe("promptSurface", () => {
  it("is deterministic", () => {
    expect(promptSurface()).toBe(promptSurface());
  });

  it("covers the system prompt, the tools, and both question framings", () => {
    const surface = promptSurface();

    expect(surface).toContain("satisfy the specification's standards");
    expect(surface).toContain("validation_pass");
    expect(surface).toContain("FILE TO VALIDATE");
    expect(surface).toContain("FILES TO VALIDATE");
  });

  it("matches the locked hash — changing it is an epoch roll for every user", () => {
    const sha8 = createHash("sha256").update(promptSurface()).digest("hex").slice(0, 8);

    expect(sha8).toBe(LOCKED_SURFACE_SHA8);
  });
});
