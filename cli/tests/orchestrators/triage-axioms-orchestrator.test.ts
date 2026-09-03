import type { TriageRecord } from "@/types.js";

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { triageAxiomsOrchestrator } from "@/orchestrators/triage-axioms-orchestrator.js";
import { AxiomStore } from "@/stores/axiom-store.js";
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

  return root;
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

describe("triageAxiomsOrchestrator", () => {
  it("with --yes: accepts the organization — proposal written, parentage assigned, residual dismissed", async () => {
    const root = triageProject(standardPlan());
    const { logger, output } = createCaptureLogger();

    const outcome = await triageAxiomsOrchestrator(testContext(root, logger), { yes: true });

    const { axioms } = new AxiomStore({ projectRoot: root }).all();
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

    const outcome = await triageAxiomsOrchestrator(testContext(root, logger), { yes: true });

    const { axioms } = new AxiomStore({ projectRoot: root }).all();

    expect(outcome).toBe("ok");
    expect(axioms).toHaveLength(0);
    expect(output()).toContain("not appropriate");
  });

  it("with --reject: dismisses the whole queue with the reason", async () => {
    const root = triageProject(standardPlan());

    const outcome = await triageAxiomsOrchestrator(testContext(root), { reject: "noisy epoch" });

    const dismissals = triageRecords(root).filter((record) => record.kind === "dismissal");

    expect(outcome).toBe("ok");
    expect(dismissals).toHaveLength(3);
    expect(dismissals[0]).toMatchObject({ reason: "noisy epoch" });
  });

  it("refuses to run interactively without a TTY, naming the flags", async () => {
    const root = triageProject(standardPlan());

    const runWithoutTty = triageAxiomsOrchestrator(testContext(root), {});

    await expect(runWithoutTty).rejects.toThrow(/--yes or --reject/);
  });

  it("says so when nothing is pending", async () => {
    const { root, cleanup } = createValidatorTmpdir({
      sources: ["docs"],
      files: { "curator.js": curatorProviderModule({}) },
      curator: { model: "scripted", apiKeyEnvVar: "OPENROUTER_API_KEY", provider: "./curator.js" },
    });
    cleanups.push(cleanup);

    const outcome = await triageAxiomsOrchestrator(testContext(root), {});

    expect(outcome).toBe("ok");
    expect(triageRecords(root)).toEqual([]);
  });

  it("requires a curator, with the instructive error", async () => {
    const { root, cleanup } = createValidatorTmpdir({ sources: ["docs"], files: {} });
    cleanups.push(cleanup);

    const runWithoutCurator = triageAxiomsOrchestrator(testContext(root), { yes: true });

    await expect(runWithoutCurator).rejects.toThrow(/"curator": \{/);
  });
});
