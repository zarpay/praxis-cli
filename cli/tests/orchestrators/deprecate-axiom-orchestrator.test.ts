import type { TriageRecord } from "@/types.js";

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { AxiomFile } from "@/models/axiom-file.js";
import { deprecateAxiomOrchestrator } from "@/orchestrators/deprecate-axiom-orchestrator.js";
import { axiomContent } from "@tests/helpers/axiom-fixtures.js";
import { createCaptureLogger } from "@tests/helpers/capture-logger.js";
import { testContext } from "@tests/helpers/command-context.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

/** A project with one active axiom. */
function axiomProject(): string {
  const axiom = axiomContent(
    { id: "AX-aaaa11", grounded_in: "docs/README.md#errors" },
    { statement: "Error messages name what would be accepted." },
  );
  const { root, cleanup } = createValidatorTmpdir({
    sources: ["docs"],
    files: {
      "docs/README.md": "# Spec",
      [".praxis/axioms/AX-aaaa11.md"]: axiom,
    },
  });
  cleanups.push(cleanup);

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

describe("deprecateAxiomOrchestrator", () => {
  it("flips status, preserves the body, records the reason", async () => {
    const root = axiomProject();
    const { logger } = createCaptureLogger();

    const outcome = await deprecateAxiomOrchestrator(testContext(root, logger), {
      id: "AX-aaaa11",
      reason: "now a lint rule",
    });

    expect(outcome).toBe("ok");

    const path = join(root, ".praxis", "axioms", "AX-aaaa11.md");
    const retired = AxiomFile.fromContent(readFileSync(path, "utf8"), path);
    expect(retired.status).toBe("deprecated");
    expect(retired.statement()).toBe("Error messages name what would be accepted.");

    const records = triageRecords(root);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      kind: "deprecation",
      axiom_id: "AX-aaaa11",
      reason: "now a lint rule",
    });
  });

  it("refuses an id that names no active axiom", async () => {
    const root = axiomProject();
    const { logger } = createCaptureLogger();

    const deprecateUnknown = deprecateAxiomOrchestrator(testContext(root, logger), {
      id: "AX-000000",
      reason: "nope",
    });

    await expect(deprecateUnknown).rejects.toThrow(/No axiom "AX-000000"/);
  });
});
