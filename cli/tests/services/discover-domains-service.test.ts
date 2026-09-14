import { afterEach, describe, expect, it } from "vitest";

import discoverDomainsService from "@/services/discover-domains-service.js";
import { testConfig } from "@tests/helpers/test-config.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

/** A project with the given files under `src`. */
function project(files: Record<string, string>): string {
  const { root, cleanup } = createValidatorTmpdir({ sources: ["src"], files });

  cleanups.push(cleanup);

  return root;
}

/** The domains discovered, with a config rooted at `src`. */
function domains(root: string) {
  return discoverDomainsService(testConfig(root, { sources: ["src"] }), {});
}

describe("discoverDomainsService", () => {
  it("finds one domain per spec file", () => {
    const root = project({
      "src/services/README.md": "# Services\n",
      "src/features/README.md": "# Features\n",
      "src/services/a.ts": "a\n",
    });

    expect(domains(root)).toHaveLength(2);
  });

  it("types a domain by its directory relative to the root", () => {
    const root = project({ "src/services/README.md": "# Services\n", "src/services/a.ts": "a\n" });

    expect(domains(root)[0]?.type).toBe("src/services");
  });

  it("expands `paths:` into an explicit target list", () => {
    const root = project({
      "src/services/README.md": '---\npaths:\n  - "src/services/*.ts"\n---\n\n# Services\n',
      "src/services/a.ts": "a\n",
      "src/services/b.ts": "b\n",
      "src/other/c.ts": "c\n",
    });
    const targets = domains(root)[0]?.targetFiles ?? [];

    expect(targets).toHaveLength(2);
    expect(targets.some((t) => t.endsWith("/c.ts"))).toBe(false);
  });

  it("shields `excludes:` from the target list — the reviewer never sees them", () => {
    const root = project({
      "src/services/README.md":
        '---\npaths:\n  - "src/services/*.ts"\nexcludes:\n  - "src/services/legacy.ts"\n---\n\n# S\n',
      "src/services/a.ts": "a\n",
      "src/services/legacy.ts": "legacy\n",
    });
    const targets = domains(root)[0]?.targetFiles ?? [];

    expect(targets).toHaveLength(1);
    expect(targets[0]?.endsWith("/a.ts")).toBe(true);
  });

  it("matches directories rather than files under cohort: by_directory", () => {
    const root = project({
      "src/features/README.md":
        '---\npaths:\n  - "src/features/*"\ncohort: by_directory\n---\n\n# F\n',
      "src/features/loyalty/a.ts": "a\n",
      "src/features/awards/b.ts": "b\n",
    });
    const domain = domains(root)[0];

    expect(domain?.cohort).toBe("by_directory");
    expect(domain?.targetDirs).toHaveLength(2);
    expect(domain?.targetFiles).toBeUndefined();
  });

  it("leaves targetFiles unset when a spec declares no paths — it governs its siblings", () => {
    const root = project({ "src/docs/README.md": "# Docs\n", "src/docs/guide.md": "# G\n" });

    expect(domains(root)[0]?.targetFiles).toBeUndefined();
  });

  it("never lets a spec file become its own target", () => {
    const root = project({
      "src/services/README.md": '---\npaths:\n  - "src/services/*"\n---\n\n# S\n',
      "src/services/a.ts": "a\n",
    });
    const targets = domains(root)[0]?.targetFiles ?? [];

    expect(targets.some((t) => t.endsWith("README.md"))).toBe(false);
  });
});
