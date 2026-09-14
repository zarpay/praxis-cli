import type { PendingCritique } from "@/types.js";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import organizeTriageService from "@/services/organize-triage-service.js";
import { curatorProviderModule } from "@tests/helpers/curator-provider.js";
import { testConfig } from "@tests/helpers/test-config.js";
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

/** One pending critique the curator may cluster. */
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

/** The clusters a scripted curator produces for two known critiques. */
async function organize(organization: unknown, axioms = [{ id: "AX-aaaaaa", statement: "S" }]) {
  const { root, cleanup } = createValidatorTmpdir({
    sources: ["docs"],
    files: { "docs/README.md": "# Spec\n", "curator.js": curatorProviderModule({ organization }) },
  });
  cleanups.push(cleanup);

  const cfg = testConfig(root, {
    sources: ["docs"],
    curator: { model: "scripted", apiKeyEnvVar: "OPENROUTER_API_KEY", provider: "./curator.js" },
  });

  return await organizeTriageService(cfg, {
    specPath: "docs/README.md",
    specContent: "# Spec\n",
    critiques: [critique("r1:1"), critique("r1:2")],
    axioms,
  });
}

describe("organizeTriageService", () => {
  it("returns the clusters the curator proposed", async () => {
    const { clusters } = await organize({
      clusters: [
        { critique_ids: ["r1:1", "r1:2"], rationale: "Both about errors.", suggestion: "hold" },
      ],
    });

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.critiqueIds).toEqual(["r1:1", "r1:2"]);
    expect(clusters[0]?.rationale).toBe("Both about errors.");
  });

  it("drops a critique id it was never given — a hallucination costs nothing", async () => {
    const { clusters } = await organize({
      clusters: [{ critique_ids: ["r1:1", "r9:9"], rationale: "r", suggestion: "hold" }],
    });

    expect(clusters[0]?.critiqueIds).toEqual(["r1:1"]);
  });

  it("drops a cluster left with no real critiques at all", async () => {
    const { clusters } = await organize({
      clusters: [{ critique_ids: ["r9:9"], rationale: "r", suggestion: "hold" }],
    });

    expect(clusters).toEqual([]);
  });

  it("keeps an assignment to an axiom that exists", async () => {
    const { clusters } = await organize({
      clusters: [
        { critique_ids: ["r1:1"], rationale: "r", suggestion: "assign", axiom_id: "AX-aaaaaa" },
      ],
    });

    expect(clusters[0]?.suggestion).toEqual({ kind: "assign", axiomId: "AX-aaaaaa" });
  });

  it("demotes an assignment to an invented axiom into a hold, never an assignment", async () => {
    // The hallucination guard: a curator's invention must cost human
    // attention, never corrupt a label.
    const { clusters } = await organize({
      clusters: [
        { critique_ids: ["r1:1"], rationale: "r", suggestion: "assign", axiom_id: "AX-nope99" },
      ],
    });

    expect(clusters[0]?.suggestion.kind).toBe("hold");
  });

  it("demotes a proposal with no statement into a hold", async () => {
    const { clusters } = await organize({
      clusters: [{ critique_ids: ["r1:1"], rationale: "r", suggestion: "propose", draft: {} }],
    });

    expect(clusters[0]?.suggestion.kind).toBe("hold");
  });

  it("keeps a proposal that carries a statement", async () => {
    const { clusters } = await organize({
      clusters: [
        {
          critique_ids: ["r1:1"],
          rationale: "r",
          suggestion: "propose",
          draft: { statement: "Errors name what would be accepted.", grounding_hint: "#errors" },
        },
      ],
    });

    expect(clusters[0]?.suggestion).toEqual({
      kind: "propose",
      draft: { statement: "Errors name what would be accepted.", groundingHint: "#errors" },
    });
  });

  it("explains a hold the curator gave no reason for", async () => {
    const { clusters } = await organize({
      clusters: [{ critique_ids: ["r1:1"], rationale: "r", suggestion: "nonsense" }],
    });

    expect(clusters[0]?.suggestion).toMatchObject({ kind: "hold" });
    expect(JSON.stringify(clusters[0]?.suggestion)).toContain("did not validate");
  });

  it("returns no clusters when the curator returned none", async () => {
    const { clusters } = await organize({ clusters: [] });

    expect(clusters).toEqual([]);
  });
});
