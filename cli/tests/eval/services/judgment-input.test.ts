import { afterEach, describe, expect, it } from "vitest";

import resolveAssistInputs from "@/eval/services/resolve-assist-inputs-service.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

/** Builds a project root holding the given files, cleaned up after the test. */
function project(files: Record<string, string>): string {
  const { root, cleanup } = createValidatorTmpdir({ sources: ["specs"], files });
  cleanups.push(cleanup);
  return root;
}

/** Wraps frontmatter lines in a spec document. */
function spec(lines: string[]): string {
  return ["---", ...lines, "---", "", "# Spec"].join("\n");
}

describe("resolveAssistInputs", () => {
  it("resolves nothing for a spec declaring neither key", () => {
    const assist = resolveAssistInputs({
      specContent: spec(["paths:", '  - "src/*.ts"']),
      specPath: "specs/README.md",
      root: project({}),
    });

    expect(assist).toEqual({ exemplars: [], context: [] });
  });

  it("resolves an exemplar glob to its file contents", () => {
    const root = project({ "src/good.ts": "export const good = 1;" });
    const assist = resolveAssistInputs({
      specContent: spec(["exemplars:", '  - "src/*.ts"']),
      specPath: "specs/README.md",
      root,
    });

    expect(assist.exemplars).toEqual([{ path: "src/good.ts", content: "export const good = 1;" }]);
  });

  it("keeps exemplars and context in separate lists", () => {
    const root = project({ "src/good.ts": "good", "docs/why.md": "why" });
    const assist = resolveAssistInputs({
      specContent: spec(["exemplars:", '  - "src/*.ts"', "context:", '  - "docs/*.md"']),
      specPath: "specs/README.md",
      root,
    });

    expect(assist.exemplars.map((f) => f.path)).toEqual(["src/good.ts"]);
    expect(assist.context.map((f) => f.path)).toEqual(["docs/why.md"]);
  });

  it("sorts resolved files so the hash is deterministic", () => {
    const root = project({ "src/c.ts": "c", "src/a.ts": "a", "src/b.ts": "b" });
    const assist = resolveAssistInputs({
      specContent: spec(["exemplars:", '  - "src/*.ts"']),
      specPath: "specs/README.md",
      root,
    });

    expect(assist.exemplars.map((f) => f.path)).toEqual(["src/a.ts", "src/b.ts", "src/c.ts"]);
  });

  it("resolves a glob matching nothing to an empty list", () => {
    const assist = resolveAssistInputs({
      specContent: spec(["exemplars:", '  - "src/nope-*.ts"']),
      specPath: "specs/README.md",
      root: project({}),
    });

    expect(assist.exemplars).toEqual([]);
  });

  it("raises when a key is declared and no root can resolve it", () => {
    const resolve = () =>
      resolveAssistInputs({
        specContent: spec(["exemplars:", '  - "src/*.ts"']),
        specPath: "specs/README.md",
      });

    expect(resolve).toThrow(/declares "exemplars" but no project root/);
  });

  it("does not raise without a root when neither key is declared", () => {
    const assist = resolveAssistInputs({
      specContent: spec(["paths:", '  - "src/*.ts"']),
      specPath: "specs/README.md",
    });

    expect(assist).toEqual({ exemplars: [], context: [] });
  });
});
