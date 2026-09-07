import type { TriageRecord } from "@/types.js";

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, afterAll, describe, expect, it } from "vitest";

import { triageAxiomsOrchestrator } from "@/orchestrators/triage-axioms-orchestrator.js";
import { axiomContent } from "@tests/helpers/axiom-fixtures.js";
import { createCaptureLogger } from "@tests/helpers/capture-logger.js";
import { testContext } from "@tests/helpers/command-context.js";
import { curatorProviderModule } from "@tests/helpers/curator-provider.js";
import { critiqueLine, seedLedgerRun } from "@tests/helpers/ledger-runs.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

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

const AXIOM = "AX-aaaa11";

/** A project with an active axiom, two pending critiques, a scripted curator. */
function labelingProject(labels: unknown, withCurator = true): string {
  const axiom = axiomContent(
    { id: AXIOM, grounded_in: "docs/README.md#errors" },
    { statement: "Error messages name what would be accepted." },
  );

  const { root, cleanup } = createValidatorTmpdir({
    sources: ["docs"],
    files: {
      "docs/README.md": "# Spec\n\n## Errors\n\nError messages name what would be accepted.",
      "docs/guide.md": "# Guide",
      [".praxis/axioms/AX-aaaa11.md"]: axiom,
      "curator.js": curatorProviderModule({ labels }),
    },
    ...(withCurator
      ? {
          curator: {
            model: "scripted",
            apiKeyEnvVar: "OPENROUTER_API_KEY",
            provider: "./curator.js",
          },
        }
      : {}),
  });
  cleanups.push(cleanup);

  seedLedgerRun(root, {
    name: "flash",
    hash: "aaaa1111",
    runId: "r1",
    extraLines: [
      critiqueLine({
        runId: "r1",
        seq: 1,
        filePath: "docs/guide.md",
        specPath: "docs/README.md",
        text: "Error message 'bad subject' names nothing.",
      }),
      critiqueLine({
        runId: "r1",
        seq: 2,
        filePath: "docs/guide.md",
        specPath: "docs/README.md",
        text: "Recommended an async queue.",
      }),
    ],
  });

  return root;
}

/** Every triage record across session files. */
function triageRecords(root: string): TriageRecord[] {
  const dir = join(root, ".praxis", "ledger", "triage");

  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .sort()
    .flatMap((file) =>
      readFileSync(join(dir, file), "utf8")
        .trimEnd()
        .split("\n")
        .map((line) => JSON.parse(line) as TriageRecord),
    );
}

describe("triageAxiomsOrchestrator", () => {
  it("labels confident matches as matcher assignments; the residue stays pending", async () => {
    const root = labelingProject({
      labels: [
        { critique_id: "r1:1", axiom_id: AXIOM },
        { critique_id: "r1:2", axiom_id: null },
      ],
    });
    const { logger, output } = createCaptureLogger();

    const outcome = await triageAxiomsOrchestrator(testContext(root, logger), { dryRun: false });

    expect(outcome).toBe("ok");
    expect(output()).toContain("Labeling 2 untriaged critique(s)");

    const records = triageRecords(root);
    const assignments = records.filter((record) => record.kind === "assignment");
    const unmatched = records.filter((record) => record.kind === "unmatched");
    expect(assignments).toHaveLength(1);
    expect(assignments[0]).toMatchObject({
      kind: "assignment",
      critique_id: "r1:1",
      axiom_id: AXIOM,
      axiom_version: 1,
      assigned_by: { decision: "matcher", suggested_by: "scripted" },
    });
    // The declined critique is categorized, not forgotten: an unmatched
    // record pins the axiom set it was judged against.
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0]).toMatchObject({
      kind: "unmatched",
      critique_id: "r1:2",
      considered: [`${AXIOM}@1`],
    });
  });

  it("a hallucinated axiom id never becomes an assignment or an unmatched verdict", async () => {
    const root = labelingProject({
      labels: [
        { critique_id: "r1:1", axiom_id: "AX-000000" },
        { critique_id: "r1:2", axiom_id: "AX-000000" },
      ],
    });
    const { logger } = createCaptureLogger();

    await triageAxiomsOrchestrator(testContext(root, logger), { dryRun: false });

    expect(triageRecords(root)).toHaveLength(0);
  });

  it("--dry-run proposes without writing", async () => {
    const root = labelingProject({
      labels: [{ critique_id: "r1:1", axiom_id: AXIOM }],
    });
    const { logger, output } = createCaptureLogger();

    await triageAxiomsOrchestrator(testContext(root, logger), { dryRun: true });

    expect(triageRecords(root)).toHaveLength(0);
    expect(output()).toContain("Dry run — nothing was written");
  });

  it("without a curator: warns, defers, writes nothing", async () => {
    const root = labelingProject(undefined, false);
    const { logger, output } = createCaptureLogger();

    const outcome = await triageAxiomsOrchestrator(testContext(root, logger), { dryRun: false });

    expect(outcome).toBe("ok");
    expect(output()).toContain("no curator is configured — labeling is deferred");
    expect(triageRecords(root)).toHaveLength(0);
  });

  it("an empty backlog says so and stops", async () => {
    const { root, cleanup } = createValidatorTmpdir({
      sources: ["docs"],
      files: { "docs/README.md": "# Spec" },
    });
    cleanups.push(cleanup);
    const { logger, output } = createCaptureLogger();

    const outcome = await triageAxiomsOrchestrator(testContext(root, logger), { dryRun: false });

    expect(outcome).toBe("ok");
    expect(output()).toContain("Nothing untriaged");
  });
});
