import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import discoverDomainsService from "@/services/discover-domains-service.js";
import resolveUnitsService from "@/services/resolve-units-service.js";
import { testConfig } from "@tests/helpers/test-config.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

/** A project, and the units its first domain resolves to. */
function unitsOf(files: Record<string, string>) {
  const { root, cleanup } = createValidatorTmpdir({ sources: ["src"], files });
  cleanups.push(cleanup);

  const cfg = testConfig(root, { sources: ["src"] });
  const [domain] = discoverDomainsService(cfg, {});
  const units = resolveUnitsService(cfg, { domain: domain });

  return { root, units };
}

describe("resolveUnitsService", () => {
  it("yields one unit per file under by_file, each its own only member", () => {
    const { units } = unitsOf({
      "src/services/README.md": '---\npaths:\n  - "src/services/*.ts"\n---\n\n# S\n',
      "src/services/a.ts": "a\n",
      "src/services/b.ts": "b\n",
    });

    expect(units).toHaveLength(2);
    expect(units.every((u) => u.files.length === 1 && u.files[0] === u.path)).toBe(true);
  });

  it("yields one unit per directory under by_directory, holding its members", () => {
    const { units } = unitsOf({
      "src/features/README.md":
        '---\npaths:\n  - "src/features/*"\ncohort: by_directory\n---\n\n# F\n',
      "src/features/loyalty/a.ts": "a\n",
      "src/features/loyalty/b.ts": "b\n",
    });

    expect(units).toHaveLength(1);
    expect(units[0]?.files).toHaveLength(2);
    expect(units[0]?.path.endsWith("/loyalty")).toBe(true);
  });

  it("sorts cohort members, so the assembled text is stable across machines", () => {
    const { units } = unitsOf({
      "src/features/README.md":
        '---\npaths:\n  - "src/features/*"\ncohort: by_directory\n---\n\n# F\n',
      "src/features/loyalty/b.ts": "b\n",
      "src/features/loyalty/a.ts": "a\n",
    });
    const members = units[0]?.files ?? [];

    expect([...members].sort()).toEqual(members);
  });

  it("drops a genuinely empty cohort directory — there is nothing to review", () => {
    const { root, units } = unitsOf({
      "src/features/README.md":
        '---\npaths:\n  - "src/features/*"\ncohort: by_directory\n---\n\n# F\n',
      "src/features/loyalty/a.ts": "a\n",
    });

    // Created after the fixture, because an empty directory holds no file
    // to declare — and a `.keep` would be a member, dot: true being set.
    mkdirSync(join(root, "src", "features", "empty"), { recursive: true });
    const cfg = testConfig(root, { sources: ["src"] });
    const [domain] = discoverDomainsService(cfg, {});
    const afterEmpty = resolveUnitsService(cfg, { domain: domain });

    expect(units).toHaveLength(1);
    expect(afterEmpty).toHaveLength(1);
    expect(afterEmpty[0]?.path.endsWith("/loyalty")).toBe(true);
  });

  it("gathers a cohort's members recursively", () => {
    const { units } = unitsOf({
      "src/features/README.md":
        '---\npaths:\n  - "src/features/*"\ncohort: by_directory\n---\n\n# F\n',
      "src/features/loyalty/a.ts": "a\n",
      "src/features/loyalty/nested/b.ts": "b\n",
    });

    expect(units[0]?.files).toHaveLength(2);
  });

  it("falls back to the spec's sibling markdown when no paths are declared", () => {
    const { units } = unitsOf({
      "src/docs/README.md": "# Docs\n",
      "src/docs/guide.md": "# Guide\n",
      "src/docs/notes.md": "# Notes\n",
    });

    expect(units).toHaveLength(2);
    expect(units.every((u) => u.path.endsWith(".md"))).toBe(true);
  });

  it("never makes the spec file a unit of itself", () => {
    const { units } = unitsOf({ "src/docs/README.md": "# Docs\n", "src/docs/guide.md": "# G\n" });

    expect(units.some((u) => u.path.endsWith("README.md"))).toBe(false);
  });
});
