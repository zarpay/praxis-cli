import { afterEach, describe, expect, it } from "vitest";

import measureEvalCoverageService from "@/services/measure-eval-coverage-service.js";
import { testConfig } from "@tests/helpers/test-config.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

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

describe("measureEvalCoverageService", () => {
  it("counts governed files over every source file, spec files on neither side", () => {
    const root = partiallyGovernedProject();
    const cfg = testConfig(root, { sources: ["src"] });

    const coverage = measureEvalCoverageService(cfg, {});

    expect(coverage.governed).toBe(2);
    expect(coverage.sourceFiles).toBe(4);
    expect(coverage.rate).toBe(0.5);
    expect(coverage.display).toBe("50% (2/4 files)");
  });

  it("honors ignore patterns on the denominator", () => {
    const root = partiallyGovernedProject();
    const cfg = testConfig(root, { sources: ["src"], ignore: ["src/models/**"] });

    const coverage = measureEvalCoverageService(cfg, {});

    expect(coverage.governed).toBe(2);
    expect(coverage.sourceFiles).toBe(2);
    expect(coverage.display).toBe("100% (2/2 files)");
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

    expect(coverage.governed).toBe(1);
    expect(coverage.sourceFiles).toBe(1);
    expect(coverage.display).toBe("100% (1/1 files)");
  });

  it("reports no corpus rather than a rate when sources hold no files", () => {
    const { root, cleanup } = createValidatorTmpdir({ sources: ["src"], files: {} });

    cleanups.push(cleanup);

    const cfg = testConfig(root, { sources: ["src"] });

    const coverage = measureEvalCoverageService(cfg, {});

    expect(coverage.sourceFiles).toBe(0);
    expect(coverage.rate).toBeNull();
    expect(coverage.display).toBe("no files under sources");
  });

  it("a spec's excludes: leave files in the corpus but ungoverned", () => {
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

    expect(coverage.governed).toBe(1);
    expect(coverage.sourceFiles).toBe(2);
    expect(coverage.display).toBe("50% (1/2 files)");
  });
});
