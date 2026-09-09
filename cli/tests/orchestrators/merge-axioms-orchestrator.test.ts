import type { TriageRecord } from "@/types.js";

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { AxiomFile } from "@/models/axiom-file.js";
import { mergeAxiomsOrchestrator } from "@/orchestrators/merge-axioms-orchestrator.js";
import joinCritiqueLabelsService from "@/services/join-critique-labels-service.js";
import { RunStore } from "@/stores/run-store.js";
import { TriageStore } from "@/stores/triage-store.js";
import { axiomContent } from "@tests/helpers/axiom-fixtures.js";
import { createCaptureLogger } from "@tests/helpers/capture-logger.js";
import { testContext } from "@tests/helpers/command-context.js";
import { critiqueLine, seedLedgerRun } from "@tests/helpers/ledger-runs.js";
import { testConfig } from "@tests/helpers/test-config.js";
import { assignmentRecord } from "@tests/helpers/triage-records.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

/**
 * Three over-split doc axioms and three critiques, one assigned to each:
 * the merge's whole subject matter.
 */
function overSplitProject(): string {
  const survivor = axiomContent(
    { id: "AX-aaaa11", introduced: "2026-09-03", grounded_in: "docs/README.md#docs" },
    { statement: "Documentation teaches the reader." },
  );
  const loserOne = axiomContent(
    { id: "AX-bbbb22", introduced: "2026-09-01", grounded_in: "docs/README.md#docs" },
    { statement: "Documentation opening sentences teach." },
  );
  const loserTwo = axiomContent(
    { id: "AX-cccc33", introduced: "2026-09-02", grounded_in: "docs/README.md#docs" },
    { statement: "Documentation examples teach." },
  );

  const { root, cleanup } = createValidatorTmpdir({
    sources: ["docs"],
    files: {
      "docs/README.md": "# Spec",
      "docs/guide.md": "# Guide",
      [".praxis/axioms/AX-aaaa11.md"]: survivor,
      [".praxis/axioms/AX-bbbb22.md"]: loserOne,
      [".praxis/axioms/AX-cccc33.md"]: loserTwo,
    },
  });
  cleanups.push(cleanup);

  seedLedgerRun(root, {
    name: "flash",
    hash: "aaaa1111",
    runId: "r1",
    extraLines: [1, 2, 3].map((seq) =>
      critiqueLine({
        runId: "r1",
        seq,
        filePath: "docs/guide.md",
        specPath: "docs/README.md",
        text: `Critique ${seq}.`,
      }),
    ),
  });

  const assignments: TriageRecord[] = [
    ["r1:1", "AX-aaaa11"],
    ["r1:2", "AX-bbbb22"],
    ["r1:3", "AX-cccc33"],
  ].map(([critiqueId, axiomId]) =>
    assignmentRecord({ critique_id: critiqueId ?? "", axiom_id: axiomId ?? "" }),
  );
  new TriageStore(testConfig(root)).writeSession(assignments);

  return root;
}

describe("mergeAxiomsOrchestrator", () => {
  it("re-labels the losers' critiques, deprecates them, and adopts the earliest clock", async () => {
    const root = overSplitProject();
    const cfg = testConfig(root);
    const { logger } = createCaptureLogger();

    const outcome = await mergeAxiomsOrchestrator(testContext(root, logger), {
      ids: ["AX-bbbb22", "AX-cccc33"],
      into: "AX-aaaa11",
    });

    expect(outcome).toBe("ok");

    // The losers are deprecated with the merge named.
    for (const id of ["AX-bbbb22", "AX-cccc33"]) {
      const path = join(root, ".praxis", "axioms", `${id}.md`);
      const axiom = AxiomFile.fromContent(readFileSync(path, "utf8"), path);
      expect(axiom.status).toBe("deprecated");
    }

    // The survivor inherits the earliest introduced date among the merged.
    const survivorPath = join(root, ".praxis", "axioms", "AX-aaaa11.md");
    const survivor = AxiomFile.fromContent(readFileSync(survivorPath, "utf8"), survivorPath);
    expect(survivor.introduced).toBe("2026-09-01");

    // The join now reports every critique under the survivor — the prior
    // labels stay in the ledger beneath the merge records.
    const critiques = new RunStore(cfg).critiques();
    const labeled = joinCritiqueLabelsService(cfg, { critiques });
    const effective = labeled.map((critique) => critique.axiom_id);
    expect(effective).toEqual(["AX-aaaa11", "AX-aaaa11", "AX-aaaa11"]);
  });

  it("refuses a merge with no sources besides the survivor", async () => {
    const root = overSplitProject();
    const { logger } = createCaptureLogger();

    const selfMerge = mergeAxiomsOrchestrator(testContext(root, logger), {
      ids: ["AX-aaaa11"],
      into: "AX-aaaa11",
    });

    await expect(selfMerge).rejects.toThrow(/Nothing to merge/);
  });

  it("refuses when a named axiom does not exist", async () => {
    const root = overSplitProject();
    const { logger } = createCaptureLogger();

    const mergeUnknown = mergeAxiomsOrchestrator(testContext(root, logger), {
      ids: ["AX-000000"],
      into: "AX-aaaa11",
    });

    await expect(mergeUnknown).rejects.toThrow(/No axiom "AX-000000"/);
  });

  it("folds an already-deprecated axiom's evidence — a pre-merge-era deprecation", async () => {
    const root = overSplitProject();
    const cfg = testConfig(root);
    const { logger } = createCaptureLogger();

    const deprecated = axiomContent(
      { id: "AX-bbbb22", status: "deprecated", introduced: "2026-09-01" },
      { statement: "Documentation opening sentences teach." },
    );
    writeFileSync(join(root, ".praxis", "axioms", "AX-bbbb22.md"), deprecated);

    const outcome = await mergeAxiomsOrchestrator(testContext(root, logger), {
      ids: ["AX-bbbb22"],
      into: "AX-aaaa11",
    });

    expect(outcome).toBe("ok");

    const critiques = new RunStore(cfg).critiques();
    const labeled = joinCritiqueLabelsService(cfg, { critiques });
    const stranded = labeled.find((critique) => critique.id === "r1:2");
    expect(stranded?.axiom_id).toBe("AX-aaaa11");
  });

  it("refuses a survivor that is not active", async () => {
    const root = overSplitProject();
    const { logger } = createCaptureLogger();

    const deprecated = axiomContent(
      { id: "AX-cccc33", status: "deprecated", introduced: "2026-09-02" },
      { statement: "Documentation examples teach." },
    );
    writeFileSync(join(root, ".praxis", "axioms", "AX-cccc33.md"), deprecated);

    const mergeIntoRetired = mergeAxiomsOrchestrator(testContext(root, logger), {
      ids: ["AX-bbbb22"],
      into: "AX-cccc33",
    });

    await expect(mergeIntoRetired).rejects.toThrow(/not active/);
  });
});
