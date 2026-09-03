import { describe, expect, it, vi } from "vitest";

import { showAxiomOrchestrator } from "@/orchestrators/show-axiom-orchestrator.js";
import { createCaptureLogger } from "@tests/helpers/capture-logger.js";
import { testContext } from "@tests/helpers/command-context.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

/** A project whose store holds one active axiom. */
function projectWithAxiom(): { root: string; cleanup: () => void } {
  const axiom = [
    "---",
    "id: AX-3f9c2d",
    "version: 1",
    "status: active",
    "severity: error",
    "introduced: 2026-08-29",
    "---",
    "",
    "Statement.",
  ].join("\n");

  return createValidatorTmpdir({
    sources: ["docs"],
    files: { ".praxis/axioms/AX-3f9c2d.md": axiom },
  });
}

describe("showAxiomOrchestrator", () => {
  it("renders the axiom and succeeds", async () => {
    const { root, cleanup } = projectWithAxiom();
    const { logger, output } = createCaptureLogger();

    const outcome = await showAxiomOrchestrator(testContext(root, logger), { id: "AX-3f9c2d" });

    expect(outcome).toBe("ok");
    expect(output()).toContain("AX-3f9c2d");
    cleanup();
  });

  it("throws the instructive not-found error for an unknown id", async () => {
    const { root, cleanup } = projectWithAxiom();

    const showUnknown = showAxiomOrchestrator(testContext(root), { id: "AX-ffffff" });

    await expect(showUnknown).rejects.toThrow(/praxis axioms list/);
    cleanup();
  });
});
