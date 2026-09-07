import type { TriageRecord } from "@/types.js";

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { curateAxiomsOrchestrator } from "@/orchestrators/curate-axioms-orchestrator.js";
import { AxiomStore } from "@/stores/axiom-store.js";
import { TriageStore } from "@/stores/triage-store.js";
import { axiomContent } from "@tests/helpers/axiom-fixtures.js";
import { createCaptureLogger } from "@tests/helpers/capture-logger.js";
import { testContext } from "@tests/helpers/command-context.js";
import { curatorProviderModule } from "@tests/helpers/curator-provider.js";
import { critiqueLine, seedLedgerRun } from "@tests/helpers/ledger-runs.js";
import { testConfig } from "@tests/helpers/test-config.js";
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

/** One open-channel critique on the guide, for the seeded run. */
function guideCritique(seq: number, text: string): string {
  return critiqueLine({
    runId: "r1",
    seq,
    filePath: "docs/guide.md",
    specPath: "docs/README.md",
    text,
  });
}

/** A project with three pending critiques and a scripted curator. */
function triageProject(plan: Parameters<typeof curatorProviderModule>[0]): string {
  const { root, cleanup } = createValidatorTmpdir({
    sources: ["docs"],
    files: {
      "docs/README.md":
        "# Spec\n\n## Error messages\n\nError messages name what would be accepted.",
      "docs/guide.md": "# Guide",
      "curator.js": curatorProviderModule(plan),
    },
    curator: { model: "scripted", apiKeyEnvVar: "OPENROUTER_API_KEY", provider: "./curator.js" },
  });
  cleanups.push(cleanup);

  seedLedgerRun(root, {
    name: "flash",
    hash: "aaaa1111",
    extraLines: [
      guideCritique(1, "Error message 'bad subject' names nothing."),
      guideCritique(2, "Error text 'error' is not consumer-grade."),
      guideCritique(3, "Recommended an async queue."),
    ],
  });
  markUnmatched(root, ["r1:1", "r1:2", "r1:3"]);

  return root;
}

/** Triage's verdict on record: these critiques matched no active axiom. */
function markUnmatched(root: string, critiqueIds: string[], considered: string[] = []): void {
  new TriageStore(testConfig(root)).writeSession(
    critiqueIds.map((critiqueId) => ({
      kind: "unmatched" as const,
      critique_id: critiqueId,
      considered,
      suggested_by: "scripted",
      timestamp: "2026-09-07T10:00:00.000Z",
    })),
  );
}

/** The records a session appended, across all session files. */
function triageRecords(root: string): TriageRecord[] {
  const dir = join(root, ".praxis", "ledger", "triage");

  if (!existsSync(dir)) return [];

  return readdirSync(dir).flatMap((file) =>
    readFileSync(join(dir, file), "utf8")
      .trimEnd()
      .split("\n")
      .map((line) => JSON.parse(line) as TriageRecord),
  );
}

/** The curator's organization for the standard project above. */
function standardPlan() {
  return {
    organization: {
      clusters: [
        {
          critique_ids: ["r1:1", "r1:2"],
          rationale: "Both are consumer-hostile error messages.",
          suggestion: "propose",
          draft: {
            statement: "Error messages name what was wrong and what would be accepted instead.",
            severity: "warning",
            scope: "file",
            violating_example: "bad subject",
            compliant_example: "subject must be a non-empty string",
            grounding_hint: "Error messages name what would be accepted.",
          },
        },
        {
          critique_ids: ["r1:3"],
          rationale: "No spec passage mentions queues.",
          suggestion: "unassignable",
          why_unassignable: "The spec never mentions queues.",
        },
      ],
    },
    gate: { assessment: "appropriate", reasoning: "Turns on meaning.", judgment_half: null },
  };
}

describe("curateAxiomsOrchestrator", () => {
  it("with --yes: accepts the organization — proposal written, parentage assigned, residual dismissed", async () => {
    const root = triageProject(standardPlan());
    const { logger, output } = createCaptureLogger();

    const outcome = await curateAxiomsOrchestrator(testContext(root, logger), { yes: true });

    const { axioms } = new AxiomStore(testConfig(root)).all();
    const proposal = axioms.find((axiom) => axiom.status === "proposed");
    const records = triageRecords(root);
    const assignments = records.filter((record) => record.kind === "assignment");
    const dismissals = records.filter((record) => record.kind === "dismissal");

    expect(outcome).toBe("ok");
    expect(proposal).toBeDefined();
    expect(proposal!.statement()).toBe(
      "Error messages name what was wrong and what would be accepted instead.",
    );
    expect(assignments).toHaveLength(2);
    expect(assignments[0]).toMatchObject({
      axiom_id: proposal!.id,
      assigned_by: { decision: "flag:--yes", suggested_by: "scripted" },
    });
    expect(dismissals).toHaveLength(1);
    expect(dismissals[0]).toMatchObject({
      reason: "unassignable: The spec never mentions queues.",
    });
    expect(output()).toContain("Proposed");
  });

  it("the gate refuses a mechanical draft — nothing written, cluster stays pending (03)", async () => {
    const plan = standardPlan();
    plan.gate = {
      assessment: "not_appropriate",
      reasoning: "A regex could decide it.",
      judgment_half: null,
    };
    const root = triageProject(plan);
    const { logger, output } = createCaptureLogger();

    const outcome = await curateAxiomsOrchestrator(testContext(root, logger), { yes: true });

    const { axioms } = new AxiomStore(testConfig(root)).all();

    expect(outcome).toBe("ok");
    expect(axioms).toHaveLength(0);
    expect(output()).toContain("not appropriate");
  });

  it("identical critique texts dedup into one cluster member, but every duplicate gets a record", async () => {
    const { root, cleanup } = createValidatorTmpdir({
      sources: ["docs"],
      files: {
        "docs/README.md":
          "# Spec\n\n## Error messages\n\nError messages name what would be accepted.",
        "docs/guide.md": "# Guide",
        "curator.js": curatorProviderModule({
          organization: {
            clusters: [
              {
                critique_ids: ["r1:1"],
                rationale: "The same consumer-hostile message, three runs over.",
                suggestion: "unassignable",
                why_unassignable: "The spec never mentions it.",
              },
            ],
          },
        }),
      },
      curator: { model: "scripted", apiKeyEnvVar: "OPENROUTER_API_KEY", provider: "./curator.js" },
    });
    cleanups.push(cleanup);

    seedLedgerRun(root, {
      name: "flash",
      hash: "aaaa1111",
      extraLines: [
        guideCritique(1, "Error message 'bad subject' names nothing."),
        guideCritique(2, "Error message 'bad subject' names nothing."),
        guideCritique(3, "Error message 'bad subject' names nothing."),
      ],
    });
    markUnmatched(root, ["r1:1", "r1:2", "r1:3"]);
    const { logger } = createCaptureLogger();

    const outcome = await curateAxiomsOrchestrator(testContext(root, logger), { yes: true });

    expect(outcome).toBe("ok");

    const records = triageRecords(root);
    const dismissals = records.filter((record) => record.kind === "dismissal");
    const dismissedIds = dismissals.map((record) => record.critique_id).sort();
    expect(dismissedIds).toEqual(["r1:1", "r1:2", "r1:3"]);
  });

  it("a draft whose remediation an existing axiom carries folds there — never a twin", async () => {
    const axiom = axiomContent(
      { id: "AX-ffff99", grounded_in: "docs/README.md#error-messages" },
      { statement: "Error messages name what was wrong and what would be accepted." },
    );
    const { root, cleanup } = createValidatorTmpdir({
      sources: ["docs"],
      files: {
        "docs/README.md":
          "# Spec\n\n## Error messages\n\nError messages name what would be accepted.",
        "docs/guide.md": "# Guide",
        [".praxis/axioms/AX-ffff99.md"]: axiom,
        "curator.js": curatorProviderModule({
          organization: {
            clusters: [
              {
                critique_ids: ["r1:1"],
                rationale: "Consumer-hostile error message.",
                suggestion: "propose",
                draft: {
                  statement: "Errors must say what would be accepted.",
                  severity: "warning",
                  violating_example: "bad",
                  compliant_example: "good",
                  grounding_hint: "Error messages name what would be accepted.",
                },
              },
            ],
          },
          gate: {
            assessment: "appropriate",
            reasoning: "Turns on meaning.",
            judgment_half: null,
            duplicate_of: "AX-ffff99",
          },
        }),
      },
      curator: { model: "scripted", apiKeyEnvVar: "OPENROUTER_API_KEY", provider: "./curator.js" },
    });
    cleanups.push(cleanup);

    seedLedgerRun(root, {
      name: "flash",
      hash: "aaaa1111",
      extraLines: [guideCritique(1, "Error message 'bad subject' names nothing.")],
    });
    markUnmatched(root, ["r1:1"], ["AX-ffff99@1"]);
    const { logger } = createCaptureLogger();

    const outcome = await curateAxiomsOrchestrator(testContext(root, logger), { yes: true });

    expect(outcome).toBe("ok");

    // No proposal was written; the cluster folded into the existing axiom.
    const proposedDir = join(root, ".praxis", "axioms", "proposed");
    expect(existsSync(proposedDir)).toBe(false);

    const records = triageRecords(root);
    const assignments = records.filter((record) => record.kind === "assignment");
    expect(assignments).toHaveLength(1);
    expect(assignments[0]).toMatchObject({
      critique_id: "r1:1",
      axiom_id: "AX-ffff99",
    });
  });

  it("with --reject: dismisses the whole queue with the reason", async () => {
    const root = triageProject(standardPlan());

    const outcome = await curateAxiomsOrchestrator(testContext(root), { reject: "noisy epoch" });

    const dismissals = triageRecords(root).filter((record) => record.kind === "dismissal");

    expect(outcome).toBe("ok");
    expect(dismissals).toHaveLength(3);
    expect(dismissals[0]).toMatchObject({ reason: "noisy epoch" });
  });

  it("refuses to run interactively without a TTY, naming the flags", async () => {
    const root = triageProject(standardPlan());

    const runWithoutTty = curateAxiomsOrchestrator(testContext(root), {});

    await expect(runWithoutTty).rejects.toThrow(/--yes or --reject/);
  });

  it("says so when nothing is pending", async () => {
    const { root, cleanup } = createValidatorTmpdir({
      sources: ["docs"],
      files: { "curator.js": curatorProviderModule({}) },
      curator: { model: "scripted", apiKeyEnvVar: "OPENROUTER_API_KEY", provider: "./curator.js" },
    });
    cleanups.push(cleanup);

    const outcome = await curateAxiomsOrchestrator(testContext(root), {});

    expect(outcome).toBe("ok");
    expect(triageRecords(root)).toEqual([]);
  });

  it("requires a curator, with the instructive error", async () => {
    const { root, cleanup } = createValidatorTmpdir({ sources: ["docs"], files: {} });
    cleanups.push(cleanup);

    const runWithoutCurator = curateAxiomsOrchestrator(testContext(root), { yes: true });

    await expect(runWithoutCurator).rejects.toThrow(/"curator": \{/);
  });
});
