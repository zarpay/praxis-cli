import { afterEach, describe, expect, it } from "vitest";

import { assistFileRecords, assistHashInput, resolveAssistInputs } from "@/eval/judgment-input.js";
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

describe("assistHashInput", () => {
  it("is empty when the spec declares no assist inputs", () => {
    const input = assistHashInput({ exemplars: [], context: [] });

    expect(input).toBe("");
  });

  it("labels each block with its kind and path", () => {
    const input = assistHashInput({
      exemplars: [{ path: "src/a.ts", content: "A" }],
      context: [{ path: "docs/w.md", content: "W" }],
    });

    expect(input).toBe("EXEMPLAR src/a.ts\nA\nCONTEXT docs/w.md\nW");
  });

  it("distinguishes the same content used as exemplar versus context", () => {
    const file = { path: "src/a.ts", content: "A" };
    const asExemplar = assistHashInput({ exemplars: [file], context: [] });
    const asContext = assistHashInput({ exemplars: [], context: [file] });

    expect(asExemplar).not.toBe(asContext);
  });

  it("distinguishes identical content at different paths", () => {
    const here = assistHashInput({ exemplars: [{ path: "a.ts", content: "X" }], context: [] });
    const there = assistHashInput({ exemplars: [{ path: "b.ts", content: "X" }], context: [] });

    expect(here).not.toBe(there);
  });
});

describe("assistFileRecords", () => {
  it("records each file's path with an 8-char content hash", () => {
    const records = assistFileRecords([{ path: "src/a.ts", content: "A" }]);

    expect(records[0].path).toBe("src/a.ts");
    expect(records[0].hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it("hashes identical content to the same value regardless of path", () => {
    const records = assistFileRecords([
      { path: "src/a.ts", content: "same" },
      { path: "src/b.ts", content: "same" },
    ]);

    expect(records[0].hash).toBe(records[1].hash);
  });

  it("hashes different content differently", () => {
    const records = assistFileRecords([
      { path: "a.ts", content: "one" },
      { path: "b.ts", content: "two" },
    ]);

    expect(records[0].hash).not.toBe(records[1].hash);
  });

  it("returns nothing for no files", () => {
    const records = assistFileRecords([]);

    expect(records).toEqual([]);
  });
});
