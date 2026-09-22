import type { ReviewerConfig, Verdict } from "@/types.js";

import { afterEach, describe, expect, it } from "vitest";

import { Reviewer } from "@/models/reviewer.js";
import measureEvalCoverageService from "@/services/measure-eval-coverage-service.js";
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

const PASS: Verdict = { compliant: true, issues: [], reason: "clean" };
const FAIL: Verdict = { compliant: false, severity: "error", issues: [], reason: "violates" };

/** A project whose spec governs two of the four source files. */
function partiallyGovernedProject(): string {
  const { root, cleanup } = createValidatorTmpdir({
    sources: ["src"],
    files: {
      "src/services/README.md": '---\npaths:\n  - "src/services/*.ts"\n---\n\n# Services\n',
      "src/services/a.ts": "a\n",
      "src/services/b.ts": "b\n",
      "src/models/c.ts": "c\n",
      "src/models/d.ts": "d\n",
    },
  });

  cleanups.push(cleanup);

  return root;
}

/** Caches one reviewer's verdict for a governed target. */
function cache(root: string, reviewer: ReviewerConfig, target: string, result: Verdict): void {
  const cfg = testConfig(root, { sources: ["src"], reviewers: REVIEWERS });
  const store = new VerdictStore(cfg, { reviewer: Reviewer.fromConfig(reviewer).cacheIdentity() });

  store.writeVerdict({
    targetPath: `${root}/src/services/${target}`,
    specPath: `${root}/src/services/README.md`,
    contentHash: "hash",
    result,
  });
}

describe("observed — the structural slice", () => {
  it("counts governed files over every source file, spec files on neither side", () => {
    const root = partiallyGovernedProject();
    const cfg = testConfig(root, { sources: ["src"] });

    const coverage = measureEvalCoverageService(cfg, {});

    expect(coverage.sourceFiles).toBe(4);
    expect(coverage.observed.files).toBe(2);
    expect(coverage.observed.rate).toBe(0.5);
    expect(coverage.observed.display).toBe("50% (2/4 files)");
  });

  it("honors ignore patterns on the denominator", () => {
    const root = partiallyGovernedProject();
    const cfg = testConfig(root, { sources: ["src"], ignore: ["src/models/**"] });

    const coverage = measureEvalCoverageService(cfg, {});

    expect(coverage.sourceFiles).toBe(2);
    expect(coverage.observed.display).toBe("100% (2/2 files)");
  });

  it("excludes the authored taxonomy from the corpus — direction, not corpus", () => {
    const { root, cleanup } = createValidatorTmpdir({
      sources: ["src", "docs"],
      files: {
        "src/services/README.md": '---\npaths:\n  - "src/services/*.ts"\n---\n\n# Services\n',
        "src/services/a.ts": "a\n",
        "docs/experts/steward.md": "---\ntitle: Steward\n---\n\n# Steward\n",
        "docs/practices/review-things.md": "---\ntitle: Review\n---\n\n# Review\n",
      },
    });

    cleanups.push(cleanup);

    const cfg = testConfig(root, {
      sources: ["src", "docs"],
      expertsDir: "docs/experts",
      practicesDir: "docs/practices",
    });

    const coverage = measureEvalCoverageService(cfg, {});

    expect(coverage.sourceFiles).toBe(1);
    expect(coverage.observed.display).toBe("100% (1/1 files)");
  });

  it("a spec's excludes: leave files in the corpus but unobserved", () => {
    const { root, cleanup } = createValidatorTmpdir({
      sources: ["src"],
      files: {
        "src/services/README.md":
          '---\npaths:\n  - "src/services/*.ts"\nexcludes:\n  - "src/services/b.ts"\n---\n\n# S\n',
        "src/services/a.ts": "a\n",
        "src/services/b.ts": "b\n",
      },
    });

    cleanups.push(cleanup);

    const cfg = testConfig(root, { sources: ["src"] });

    const coverage = measureEvalCoverageService(cfg, {});

    expect(coverage.sourceFiles).toBe(2);
    expect(coverage.observed.display).toBe("50% (1/2 files)");
  });

  it("reports no corpus rather than a rate when sources hold no files", () => {
    const { root, cleanup } = createValidatorTmpdir({ sources: ["src"], files: {} });

    cleanups.push(cleanup);

    const cfg = testConfig(root, { sources: ["src"] });

    const coverage = measureEvalCoverageService(cfg, {});

    expect(coverage.sourceFiles).toBe(0);
    expect(coverage.observed.rate).toBeNull();
    expect(coverage.passing.rate).toBeNull();
    expect(coverage.passing.display).toBe("no files under sources");
  });
});

describe("passing — the verdict-backed score", () => {
  it("counts nothing before any run: observed files are not yet passing files", () => {
    const root = partiallyGovernedProject();
    const cfg = testConfig(root, { sources: ["src"], reviewers: REVIEWERS });

    const coverage = measureEvalCoverageService(cfg, {});

    expect(coverage.observed.files).toBe(2);
    expect(coverage.passing.files).toBe(0);
    expect(coverage.passing.display).toBe("0% (0/4 files)");
  });

  it("counts a file only when every configured reviewer's verdict passes", () => {
    const root = partiallyGovernedProject();
    const cfg = testConfig(root, { sources: ["src"], reviewers: REVIEWERS });

    // a.ts: both reviewers pass. b.ts: one passes, one has no verdict.
    cache(root, REVIEWERS[0]!, "a.ts", PASS);
    cache(root, REVIEWERS[1]!, "a.ts", PASS);
    cache(root, REVIEWERS[0]!, "b.ts", PASS);

    const coverage = measureEvalCoverageService(cfg, {});

    expect(coverage.passing.files).toBe(1);
    expect(coverage.passing.display).toBe("25% (1/4 files)");
  });

  it("a failed verdict from any reviewer keeps the file out of passing", () => {
    const root = partiallyGovernedProject();
    const cfg = testConfig(root, { sources: ["src"], reviewers: REVIEWERS });

    cache(root, REVIEWERS[0]!, "a.ts", PASS);
    cache(root, REVIEWERS[1]!, "a.ts", FAIL);

    const coverage = measureEvalCoverageService(cfg, {});

    expect(coverage.passing.files).toBe(0);
  });

  it("a warn verdict is not a passing verdict", () => {
    const root = partiallyGovernedProject();
    const warned: Verdict = { compliant: false, severity: "warning", issues: [], reason: "meh" };
    const cfg = testConfig(root, { sources: ["src"], reviewers: [REVIEWERS[0]!] });

    cache(root, REVIEWERS[0]!, "a.ts", warned);
    cache(root, REVIEWERS[0]!, "b.ts", PASS);

    const coverage = measureEvalCoverageService(cfg, {});

    expect(coverage.passing.files).toBe(1);
  });
});
