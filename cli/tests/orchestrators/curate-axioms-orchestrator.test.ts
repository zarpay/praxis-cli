import type { TriageRecord } from "@/types.js";
import type { CuratorPlan } from "@tests/helpers/curator-provider.js";

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { curateAxiomsOrchestrator } from "@/orchestrators/curate-axioms-orchestrator.js";
import deriveTriageStateService from "@/services/derive-triage-state-service.js";
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
function triageProject(plan: CuratorPlan): string {
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
          suggestion: "hold",
          why_held: "The spec never mentions queues.",
        },
      ],
    },
    traceability: {
      traceable: true,
      grounding: "docs/README.md#error-messages",
      quoted_basis: "Error messages name what would be accepted.",
      reasoning: "Stated verbatim.",
    },
  };
}

describe("curateAxiomsOrchestrator", () => {
  it("with --yes: acceptance activates — axiom live with its derivation, parentage assigned, the held critique stays unmatched", async () => {
    const root = triageProject(standardPlan());
    const { logger } = createCaptureLogger();

    const outcome = await curateAxiomsOrchestrator(testContext(root, logger), { yes: true });

    const { axioms } = new AxiomStore(testConfig(root)).all();
    const activated = axioms.find((axiom) => axiom.status === "active");
    const records = triageRecords(root);
    const assignments = records.filter((record) => record.kind === "assignment");
    const dismissals = records.filter((record) => record.kind === "dismissal");
    const state = deriveTriageStateService(testConfig(root), {});
    const stillUnmatched = state.unidentified;
    const requeued = state.pending;

    expect(outcome).toBe("ok");
    expect(activated).toBeDefined();
    expect(activated!.statement()).toBe(
      "Error messages name what was wrong and what would be accepted instead.",
    );
    expect(activated!.derivedFrom).toBe("docs/README.md#error-messages");
    expect(assignments).toHaveLength(2);
    expect(assignments[0]).toMatchObject({
      axiom_id: activated!.id,
      assigned_by: { decision: "flag:--yes", suggested_by: "scripted" },
    });
    // Held: valid evidence with no axiom yet — nothing written. The
    // session activated an axiom, so the active set changed and the held
    // critique re-queues for triage against it.
    expect(dismissals).toHaveLength(0);
    expect(stillUnmatched).toHaveLength(0);
    expect(requeued.map((critique) => critique.id)).toEqual(["r1:3"]);
  });

  it("an untraceable draft is held — extend the spec, nothing written", async () => {
    const plan = standardPlan();
    plan.traceability = {
      traceable: false,
      grounding: null as unknown as string,
      quoted_basis: "",
      reasoning: "No passage states it.",
    };
    const root = triageProject(plan);
    const { logger } = createCaptureLogger();

    const outcome = await curateAxiomsOrchestrator(testContext(root, logger), { yes: true });

    expect(outcome).toBe("ok");
    expect(new AxiomStore(testConfig(root)).all().axioms).toHaveLength(0);
    // All three critiques still await curation: the cluster held, nothing decided.
    expect(deriveTriageStateService(testConfig(root), {}).unidentified).toHaveLength(3);
  });

  it("an accepted draft is written as accepted — nothing second-guesses the human's call", async () => {
    const plan = standardPlan();
    plan.organization.clusters[0].draft!.statement = "Every service exports a function named run.";
    const root = triageProject(plan);
    const { logger } = createCaptureLogger();

    const outcome = await curateAxiomsOrchestrator(testContext(root, logger), { yes: true });

    const { axioms } = new AxiomStore(testConfig(root)).all();
    const activated = axioms.find((axiom) => axiom.status === "active");
    const recordsAfterSession = triageRecords(root).length;

    // Nothing decided twice: activation changed the active set, so the
    // held critique re-queued for triage — a rerun refuses until triage
    // has considered it against the new axiom, and writes nothing.
    const rerun = curateAxiomsOrchestrator(testContext(root, logger), { yes: true });

    await expect(rerun).rejects.toThrow(/still untriaged/);

    expect(outcome).toBe("ok");
    expect(activated?.statement()).toBe("Every service exports a function named run.");
    expect(recordsAfterSession).toBe(5);
    expect(triageRecords(root)).toHaveLength(recordsAfterSession);
  });

  it("identical critique texts dedup into one cluster member, and a decision covers every duplicate", async () => {
    const axiom = axiomContent(
      { id: "AX-ffff99", derived_from: "docs/README.md#error-messages" },
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
                rationale: "The same consumer-hostile message, three runs over.",
                suggestion: "assign",
                axiom_id: "AX-ffff99",
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
    markUnmatched(root, ["r1:1", "r1:2", "r1:3"], ["AX-ffff99@1"]);
    const { logger } = createCaptureLogger();

    const outcome = await curateAxiomsOrchestrator(testContext(root, logger), { yes: true });

    expect(outcome).toBe("ok");

    const records = triageRecords(root);
    const assignments = records.filter((record) => record.kind === "assignment");
    const assignedIds = assignments.map((record) => record.critique_id).sort();
    expect(assignedIds).toEqual(["r1:1", "r1:2", "r1:3"]);
  });

  it("a leftover proposed axiom is not a fold target — the suggestion demotes to held", async () => {
    const proposal = axiomContent(
      { id: "AX-ffff99", status: "proposed" },
      { statement: "Error messages name what was wrong and what would be accepted." },
    );
    const { root, cleanup } = createValidatorTmpdir({
      sources: ["docs"],
      files: {
        "docs/README.md":
          "# Spec\n\n## Error messages\n\nError messages name what would be accepted.",
        "docs/guide.md": "# Guide",
        [".praxis/axioms/proposed/AX-ffff99.md"]: proposal,
        "curator.js": curatorProviderModule({
          organization: {
            clusters: [
              {
                critique_ids: ["r1:1"],
                rationale: "Consumer-hostile error message.",
                suggestion: "assign",
                axiom_id: "AX-ffff99",
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
      extraLines: [guideCritique(1, "Error message 'bad subject' names nothing.")],
    });
    markUnmatched(root, ["r1:1"]);
    const { logger } = createCaptureLogger();

    const outcome = await curateAxiomsOrchestrator(testContext(root, logger), { yes: true });

    expect(outcome).toBe("ok");

    // Only active axioms label: the assignment suggestion to the
    // retired-status file does not validate, so the cluster demotes to
    // held — nothing written, the critique stays in curate's queue.
    expect(triageRecords(root).filter((record) => record.kind === "assignment")).toHaveLength(0);
    expect(deriveTriageStateService(testConfig(root), {}).unidentified).toHaveLength(1);
  });

  it("a critique the curator leaves out of every cluster is held and named, never lost", async () => {
    const plan = standardPlan();
    plan.organization.clusters = plan.organization.clusters.slice(0, 1);
    const root = triageProject(plan);
    const { logger, output } = createCaptureLogger();

    const outcome = await curateAxiomsOrchestrator(testContext(root, logger), { yes: true });

    const state = deriveTriageStateService(testConfig(root), {});

    expect(outcome).toBe("ok");
    expect(output()).toContain("left 1 critique(s) out of every cluster (r1:3)");
    // The session activated an axiom, so the left-out critique re-queues
    // for triage against the changed active set — held, never lost.
    expect(state.pending.map((critique) => critique.id)).toEqual(["r1:3"]);
  });

  it("refuses to run interactively without a TTY, naming the flags", async () => {
    const root = triageProject(standardPlan());

    const runWithoutTty = curateAxiomsOrchestrator(testContext(root), {});

    await expect(runWithoutTty).rejects.toThrow(/--yes/);
  });

  it("refuses to start while any critique is untriaged — a clean triage is the precondition", async () => {
    const root = triageProject(standardPlan());
    seedLedgerRun(root, {
      name: "flash",
      hash: "aaaa1111",
      runId: "r2",
      extraLines: [
        critiqueLine({
          runId: "r2",
          seq: 1,
          filePath: "docs/guide.md",
          specPath: "docs/README.md",
          text: "A fresh critique nobody has triaged.",
        }),
      ],
    });

    const curatePastTriage = curateAxiomsOrchestrator(testContext(root), { yes: true });

    await expect(curatePastTriage).rejects.toThrow(
      /1 critique\(s\) are still untriaged.*praxis axioms triage/,
    );
    expect(triageRecords(root).filter((record) => record.kind === "assignment")).toEqual([]);
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
