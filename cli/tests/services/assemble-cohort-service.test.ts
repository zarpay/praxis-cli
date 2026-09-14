import { afterEach, describe, expect, it } from "vitest";

import assembleCohortService from "@/services/assemble-cohort-service.js";
import { testConfig } from "@tests/helpers/test-config.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

/** A project holding the given files, with its root. */
function project(files: Record<string, string>): string {
  const { root, cleanup } = createValidatorTmpdir({ sources: ["src"], files });

  cleanups.push(cleanup);

  return root;
}

describe("assembleCohortService", () => {
  it("labels each member with its project-relative path", () => {
    const root = project({
      "src/loyalty/a.ts": "const a = 1;\n",
      "src/loyalty/b.ts": "const b = 2;\n",
    });
    const unit = {
      path: `${root}/src/loyalty`,
      files: [`${root}/src/loyalty/a.ts`, `${root}/src/loyalty/b.ts`],
    };

    const assembled = assembleCohortService(testConfig(root), { unit });

    expect(assembled).toContain("===== FILE: src/loyalty/a.ts =====");
    expect(assembled).toContain("===== FILE: src/loyalty/b.ts =====");
    // Absolute paths would leak this machine into the content hash.
    expect(assembled).not.toContain(root);
  });

  it("includes every member's contents", () => {
    const root = project({
      "src/loyalty/a.ts": "const a = 1;\n",
      "src/loyalty/b.ts": "const b = 2;\n",
    });
    const unit = {
      path: `${root}/src/loyalty`,
      files: [`${root}/src/loyalty/a.ts`, `${root}/src/loyalty/b.ts`],
    };

    const assembled = assembleCohortService(testConfig(root), { unit });

    expect(assembled).toContain("const a = 1;");
    expect(assembled).toContain("const b = 2;");
  });

  it("orders members as the unit lists them, so the text is stable", () => {
    const root = project({ "src/c/a.ts": "A\n", "src/c/b.ts": "B\n" });
    const cfg = testConfig(root);
    const forward = { path: `${root}/src/c`, files: [`${root}/src/c/a.ts`, `${root}/src/c/b.ts`] };
    const reversed = { path: `${root}/src/c`, files: [`${root}/src/c/b.ts`, `${root}/src/c/a.ts`] };

    const first = assembleCohortService(cfg, { unit: forward });
    const second = assembleCohortService(cfg, { unit: reversed });

    // The exact text is part of the content hash, so member order is a
    // real input rather than an incidental detail.
    expect(first).not.toBe(second);
    expect(first.indexOf("A")).toBeLessThan(first.indexOf("B"));
  });

  it("assembles a single-member cohort without a trailing separator", () => {
    const root = project({ "src/c/only.ts": "ONLY\n" });
    const unit = { path: `${root}/src/c`, files: [`${root}/src/c/only.ts`] };

    const assembled = assembleCohortService(testConfig(root), { unit });

    expect(assembled).toBe("===== FILE: src/c/only.ts =====\n\nONLY\n");
  });

  it("is empty for a cohort with no members", () => {
    const root = project({ "src/c/keep.ts": "x\n" });
    const unit = { path: `${root}/src/c`, files: [] };

    expect(assembleCohortService(testConfig(root), { unit })).toBe("");
  });
});
