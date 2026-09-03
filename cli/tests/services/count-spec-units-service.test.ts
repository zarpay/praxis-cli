import { describe, expect, it, afterEach } from "vitest";

import { PraxisConfig } from "@/models/praxis-config.js";
import countSpecUnitsService from "@/services/count-spec-units-service.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

describe("countSpecUnitsService", () => {
  it("counts each spec's units under project-relative keys", () => {
    const { root, cleanup } = createValidatorTmpdir({
      sources: ["docs", "src"],
      files: {
        "docs/README.md": "# Docs spec",
        "docs/a.md": "# A",
        "docs/b.md": "# B",
        "src/README.md": ["---", "paths:", '  - "src/*.ts"', "---", "# Src spec"].join("\n"),
        "src/one.ts": "export {};",
        "src/two.ts": "export {};",
        "src/three.ts": "export {};",
      },
    });
    cleanups.push(cleanup);

    const counts = countSpecUnitsService({ root, config: new PraxisConfig(root) });

    expect(counts["docs/README.md"]).toBe(2);
    expect(counts["src/README.md"]).toBe(3);
  });

  it("returns an empty map for a project with no specs", () => {
    const { root, cleanup } = createValidatorTmpdir({ sources: ["docs"], files: {} });
    cleanups.push(cleanup);

    const counts = countSpecUnitsService({ root, config: new PraxisConfig(root) });

    expect(counts).toEqual({});
  });
});
