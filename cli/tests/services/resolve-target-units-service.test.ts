import { afterEach, describe, expect, it } from "vitest";

import resolveTargetUnitsService from "@/services/resolve-target-units-service.js";
import { testConfig } from "@tests/helpers/test-config.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

/** A spec judging each matched directory as one unit. */
function byDirectorySpec(paths: string): string {
  return `---\npaths:\n  - "${paths}"\ncohort: by_directory\n---\n\n# Rules\n\nBe good.\n`;
}

/** A project with a by_file domain, a cohort domain, and an excluded file. */
function project(): string {
  const { root, cleanup } = createValidatorTmpdir({
    sources: ["src"],
    specFilePattern: "README.md",
    files: {
      "src/services/README.md": `---\npaths:\n  - "src/services/*.ts"\nexcludes:\n  - "src/services/legacy.ts"\n---\n\n# Rules\n\nBe good.\n`,
      "src/services/checkout.ts": "export const checkout = 1;\n",
      "src/services/refund.ts": "export const refund = 1;\n",
      "src/services/legacy.ts": "export const legacy = 1;\n",
      "src/features/README.md": byDirectorySpec("src/features/*"),
      "src/features/loyalty/award.ts": "export const award = 1;\n",
      "src/features/loyalty/redeem.ts": "export const redeem = 1;\n",
      "docs/notes.md": "Ungoverned by anything.\n",
    },
  });

  cleanups.push(cleanup);

  return root;
}

/** The units covering a target, named root-relative. */
function unitsFor(root: string, target: string): string[] {
  const cfg = testConfig(root, { sources: ["src"] });
  const governed = resolveTargetUnitsService(cfg, { target });

  return governed.map(({ unit }) => unit.path.replace(`${root}/`, ""));
}

describe("resolveTargetUnitsService", () => {
  it("resolves a file under a by_file spec to that file", () => {
    const root = project();

    expect(unitsFor(root, "src/services/checkout.ts")).toEqual(["src/services/checkout.ts"]);
  });

  it("resolves a directory to every governed file beneath it", () => {
    const root = project();
    const units = unitsFor(root, "src/services");

    expect(units).toContain("src/services/checkout.ts");
    expect(units).toContain("src/services/refund.ts");
  });

  it("resolves a file inside a cohort to the whole cohort", () => {
    const root = project();

    // The cohort is the unit the spec judges; reviewing the member alone
    // would answer a question the spec never asks.
    expect(unitsFor(root, "src/features/loyalty/award.ts")).toEqual(["src/features/loyalty"]);
  });

  it("resolves a cohort directory to the one unit", () => {
    const root = project();

    expect(unitsFor(root, "src/features/loyalty")).toEqual(["src/features/loyalty"]);
  });

  it("covers nothing for a path no spec governs", () => {
    const root = project();

    expect(unitsFor(root, "docs/notes.md")).toEqual([]);
  });

  it("covers nothing for a file a spec excludes", () => {
    const root = project();

    expect(unitsFor(root, "src/services/legacy.ts")).toEqual([]);
  });

  it("accepts an absolute path as readily as a root-relative one", () => {
    const root = project();
    const absolute = `${root}/src/services/checkout.ts`;

    expect(unitsFor(root, absolute)).toEqual(["src/services/checkout.ts"]);
  });
});
