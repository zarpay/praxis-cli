import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { AxiomFile } from "@/models/axiom-file.js";
import { Ledger } from "@/models/ledger.js";
import { ratifyAxiomOrchestrator } from "@/orchestrators/ratify-axiom-orchestrator.js";
import { axiomContent } from "@tests/helpers/axiom-fixtures.js";
import { createCaptureLogger } from "@tests/helpers/capture-logger.js";
import { testContext } from "@tests/helpers/command-context.js";
import { curatorProviderModule } from "@tests/helpers/curator-provider.js";
import { critiqueLine, seedLedgerRun } from "@tests/helpers/ledger-runs.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

beforeAll(() => {
  process.env["OPENROUTER_API_KEY"] = "test-key";
});

afterAll(() => {
  delete process.env["OPENROUTER_API_KEY"];
});

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

const PROPOSAL = axiomContent(
  { status: "proposed", severity: "warning", grounded_in: null, introduced: "2026-09-03" },
  { statement: "Error messages name what would be accepted instead." },
);

/** A project holding the proposal, its supporting evidence, and a scripted curator. */
function ratifyProject(plan: Parameters<typeof curatorProviderModule>[0]): string {
  const { root, cleanup } = createValidatorTmpdir({
    sources: ["docs"],
    files: {
      "docs/README.md":
        "# Spec\n\n## Error messages\n\nError messages name what would be accepted.",
      ".praxis/axioms/proposed/AX-aaaa11.md": PROPOSAL,
      "curator.js": curatorProviderModule(plan),
    },
    curator: { model: "scripted", apiKeyEnvVar: "OPENROUTER_API_KEY", provider: "./curator.js" },
  });
  cleanups.push(cleanup);

  seedLedgerRun(root, {
    name: "flash",
    hash: "aaaa1111",
    runId: "r1",
    extraLines: [
      critiqueLine({
        runId: "r1",
        filePath: "docs/guide.md",
        specPath: "docs/README.md",
        text: "Error message 'bad subject' names nothing.",
      }),
    ],
  });
  new Ledger({ projectRoot: root }).appendTriageSession([
    {
      kind: "assignment",
      critique_id: "r1:1",
      axiom_id: "AX-aaaa11",
      axiom_version: 1,
      assigned_by: { decision: "human", suggested_by: "scripted" },
      timestamp: "2026-09-03T10:00:00.000Z",
    },
  ]);

  return root;
}

/** A curator that traces the proposal to the spec's error-messages section. */
function traceablePlan() {
  return {
    gate: { assessment: "appropriate", reasoning: "Turns on meaning.", judgment_half: null },
    traceability: {
      traceable: true,
      grounding: "docs/README.md#error-messages",
      quoted_basis: "Error messages name what would be accepted.",
      reasoning: "Stated verbatim.",
    },
  };
}

describe("ratifyAxiomOrchestrator", () => {
  it("with --yes and a traceable proposal: active, grounded, out of proposed/", async () => {
    const root = ratifyProject(traceablePlan());
    const { logger, output } = createCaptureLogger();

    const outcome = await ratifyAxiomOrchestrator(testContext(root, logger), {
      id: "AX-aaaa11",
      yes: true,
    });

    const activePath = join(root, ".praxis", "axioms", "AX-aaaa11.md");
    const ratified = AxiomFile.at(activePath);

    expect(outcome).toBe("ok");
    expect(ratified.status).toBe("active");
    expect(ratified.groundedIn).toBe("docs/README.md#error-messages");
    // The body a human may have edited is preserved verbatim.
    expect(ratified.statement()).toBe("Error messages name what would be accepted instead.");
    expect(existsSync(join(root, ".praxis", "axioms", "proposed", "AX-aaaa11.md"))).toBe(false);
    expect(output()).toContain("is active");
  });

  it("an untraceable proposal is not ratified — fix the spec or reject (04)", async () => {
    const plan = traceablePlan();
    plan.traceability = {
      traceable: false,
      grounding: null as unknown as string,
      quoted_basis: "The spec never states this.",
      reasoning: "No passage supports it.",
    };
    const root = ratifyProject(plan);
    const { logger, output } = createCaptureLogger();

    const outcome = await ratifyAxiomOrchestrator(testContext(root, logger), {
      id: "AX-aaaa11",
      yes: true,
    });

    expect(outcome).toBe("failed");
    expect(existsSync(join(root, ".praxis", "axioms", "proposed", "AX-aaaa11.md"))).toBe(true);
    expect(output()).toContain("Not ratified");
  });

  it("with --reject: the proposal is removed and the rejection recorded", async () => {
    const root = ratifyProject(traceablePlan());
    const { logger, output } = createCaptureLogger();

    const outcome = await ratifyAxiomOrchestrator(testContext(root, logger), {
      id: "AX-aaaa11",
      reject: "reviewer invention",
    });

    expect(outcome).toBe("ok");
    expect(existsSync(join(root, ".praxis", "axioms", "proposed", "AX-aaaa11.md"))).toBe(false);
    expect(output()).toContain("Rejected AX-aaaa11");
  });

  it("throws the not-found error for an id with no proposal", async () => {
    const root = ratifyProject(traceablePlan());

    const ratifyUnknown = ratifyAxiomOrchestrator(testContext(root), {
      id: "AX-ffffff",
      yes: true,
    });

    await expect(ratifyUnknown).rejects.toThrow(/praxis axioms list/);
  });
});
