import type { ReviewerConfig, Verdict } from "@/types.js";

import { afterEach, describe, expect, it } from "vitest";

import { Reviewer } from "@/models/reviewer.js";
import tallyValidationService from "@/services/tally-validation-service.js";
import { VerdictStore } from "@/stores/verdict-store.js";
import { testConfig } from "@tests/helpers/test-config.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

const REVIEWERS: ReviewerConfig[] = [
  { name: "one", model: "m1", apiKeyEnvVar: "OPENROUTER_API_KEY" },
  { name: "two", model: "m2", apiKeyEnvVar: "OPENROUTER_API_KEY" },
];

/** A project governing three files, none yet reviewed. */
function project(): string {
  const { root, cleanup } = createValidatorTmpdir({
    sources: ["src"],
    files: {
      "src/services/README.md": '---\npaths:\n  - "src/services/*.ts"\n---\n\n# S\n',
      "src/services/a.ts": "a\n",
      "src/services/b.ts": "b\n",
      "src/services/c.ts": "c\n",
    },
  });

  cleanups.push(cleanup);

  return root;
}

/** A config over the project, with the given reviewers. */
function config(root: string, reviewers: ReviewerConfig[] = REVIEWERS) {
  return testConfig(root, { sources: ["src"], reviewers });
}

/** Caches one reviewer's verdict for a target. */
function cache(root: string, reviewer: ReviewerConfig, target: string, result: Verdict): void {
  const cfg = config(root);
  const store = new VerdictStore(cfg, { reviewer: Reviewer.fromConfig(reviewer).cacheIdentity() });

  store.writeVerdict({
    targetPath: `${root}/src/services/${target}`,
    specPath: `${root}/src/services/README.md`,
    contentHash: "hash",
    result,
  });
}

describe("tallyValidationService", () => {
  it("counts everything as not validated before any run", () => {
    const root = project();

    const rows = tallyValidationService(config(root), {});

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ reviewer: "one", pass: 0, warn: 0, fail: 0, notValidated: 3 });
  });

  it("counts a row per reviewer, never pooled — disagreement is the point", () => {
    const root = project();
    cache(root, REVIEWERS[0], "a.ts", { compliant: true, issues: [], reason: "" });
    cache(root, REVIEWERS[1], "a.ts", {
      compliant: false,
      severity: "error",
      issues: [],
      reason: "",
    });

    const [one, two] = tallyValidationService(config(root), {});

    expect(one).toMatchObject({ reviewer: "one", pass: 1, fail: 0, notValidated: 2 });
    expect(two).toMatchObject({ reviewer: "two", pass: 0, fail: 1, notValidated: 2 });
  });

  it("separates a warning from a failure", () => {
    const root = project();
    cache(root, REVIEWERS[0], "a.ts", {
      compliant: false,
      severity: "warning",
      issues: [],
      reason: "",
    });
    cache(root, REVIEWERS[0], "b.ts", {
      compliant: false,
      severity: "error",
      issues: [],
      reason: "",
    });

    const [one] = tallyValidationService(config(root), {});

    expect(one).toMatchObject({ warn: 1, fail: 1, notValidated: 1 });
  });

  it("counts every governed unit, so an unreviewed file shows the run is overdue", () => {
    const root = project();
    cache(root, REVIEWERS[0], "a.ts", { compliant: true, issues: [], reason: "" });

    const [one] = tallyValidationService(config(root), {});
    const total = (one?.pass ?? 0) + (one?.warn ?? 0) + (one?.fail ?? 0) + (one?.notValidated ?? 0);

    expect(total).toBe(3);
  });

  it("falls back to one un-namespaced row when no reviewer is configured", () => {
    const root = project();

    const rows = tallyValidationService(config(root, []), {});

    expect(rows).toHaveLength(1);
    expect(rows[0]?.reviewer).toBeNull();
  });
});
