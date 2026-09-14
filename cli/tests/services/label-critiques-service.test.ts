import type { LabelProgressEvent, PendingCritique } from "@/types.js";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import labelCritiquesService from "@/services/label-critiques-service.js";
import { axiomContent } from "@tests/helpers/axiom-fixtures.js";
import { curatorProviderModule } from "@tests/helpers/curator-provider.js";
import { testConfig } from "@tests/helpers/test-config.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

const AXIOM = "AX-aaaa11";

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

/** One untriaged critique. */
function critique(id: string): PendingCritique {
  return {
    id,
    runId: "r1",
    filePath: "docs/guide.md",
    specPath: "docs/README.md",
    reviewerName: "flash",
    severity: "warning",
    text: `critique ${id}`,
  };
}

/** A project with the given active axioms and a scripted curator. */
function project(labels: unknown, withAxiom = true) {
  const axiom = axiomContent(
    { id: AXIOM, grounded_in: "docs/README.md#errors" },
    { statement: "Error messages name what would be accepted." },
  );

  const { root, cleanup } = createValidatorTmpdir({
    sources: ["docs"],
    files: {
      "docs/README.md": "# Spec\n",
      ...(withAxiom ? { [".praxis/axioms/AX-aaaa11.md"]: axiom } : {}),
      "curator.js": curatorProviderModule({ labels }),
    },
  });
  cleanups.push(cleanup);

  return testConfig(root, {
    sources: ["docs"],
    curator: { model: "scripted", apiKeyEnvVar: "OPENROUTER_API_KEY", provider: "./curator.js" },
  });
}

describe("labelCritiquesService", () => {
  it("labels a confident match and tallies it under its axiom", async () => {
    const cfg = project({ labels: [{ critique_id: "r1:1", axiom_id: AXIOM }] });

    const result = await labelCritiquesService(cfg, { pending: [critique("r1:1")] });

    expect(result.labels).toEqual([{ critiqueId: "r1:1", axiomId: AXIOM, axiomVersion: 1 }]);
    expect(result.labeledByAxiom).toEqual([{ axiomId: AXIOM, count: 1 }]);
    expect(result.sentToCurate).toBe(0);
  });

  it("sends a no-match to curate rather than forcing a label", async () => {
    const cfg = project({ labels: [] });

    const result = await labelCritiquesService(cfg, { pending: [critique("r1:1")] });

    expect(result.labels).toEqual([]);
    expect(result.sentToCurate).toBe(1);
  });

  it("skips the curator entirely when no axiom exists to match against", async () => {
    const cfg = project({ labels: [] }, false);

    const result = await labelCritiquesService(cfg, { pending: [critique("r1:1")] });

    // Trivially unmatched against the empty set: recorded without a call,
    // so the critique reaches curate instead of stalling untriaged.
    expect(result.skippedNoAxioms).toBe(1);
    expect(result.sentToCurate).toBe(0);
    expect(result.usage).toBeNull();
  });

  it("writes nothing under dryRun, while still reporting what it would do", async () => {
    const cfg = project({ labels: [{ critique_id: "r1:1", axiom_id: AXIOM }] });

    const result = await labelCritiquesService(cfg, {
      pending: [critique("r1:1")],
      dryRun: true,
    });

    expect(result.labels).toHaveLength(1);
    expect(result.sessionPath).toBeNull();
  });

  it("records a session when it decided anything", async () => {
    const cfg = project({ labels: [{ critique_id: "r1:1", axiom_id: AXIOM }] });

    const result = await labelCritiquesService(cfg, { pending: [critique("r1:1")] });

    expect(result.sessionPath).not.toBeNull();
  });

  it("streams one progress event per critique, carrying its outcome", async () => {
    const cfg = project({ labels: [{ critique_id: "r1:1", axiom_id: AXIOM }] });
    const seen: LabelProgressEvent[] = [];

    await labelCritiquesService(cfg, {
      pending: [critique("r1:1"), critique("r1:2")],
      onProgress: (event) => seen.push(event),
    });

    expect(seen).toHaveLength(2);
    expect(seen.map((e) => e.outcome).sort()).toEqual(["labeled", "unmatched"]);
    expect(seen.every((e) => e.total === 2)).toBe(true);
  });

  it("labels each critique on its own evidence, not its neighbours'", async () => {
    // One call per critique, so no verdict is biased by position in a list.
    const cfg = project({ labels: [{ critique_id: "r1:2", axiom_id: AXIOM }] });

    const result = await labelCritiquesService(cfg, {
      pending: [critique("r1:1"), critique("r1:2"), critique("r1:3")],
    });

    expect(result.labels).toEqual([{ critiqueId: "r1:2", axiomId: AXIOM, axiomVersion: 1 }]);
    expect(result.sentToCurate).toBe(2);
  });

  it("totals the pass's usage across every call", async () => {
    const cfg = project({ labels: [] });

    const result = await labelCritiquesService(cfg, {
      pending: [critique("r1:1"), critique("r1:2")],
    });

    expect(result.usage?.costUsd).toBeCloseTo(0.002, 10);
  });

  it("reports an empty pass for an empty backlog", async () => {
    const cfg = project({ labels: [] });

    const result = await labelCritiquesService(cfg, { pending: [] });

    expect(result).toMatchObject({ labels: [], sentToCurate: 0, failed: 0, sessionPath: null });
  });
});
