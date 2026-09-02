import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { ReviewSubject } from "@/models/review-subject.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

/** A subject for `specs/doc.md`, governed by a spec with the given frontmatter. */
function subjectWith(frontmatter: string[], files: Record<string, string> = {}): ReviewSubject {
  const { root, abs, cleanup } = createValidatorTmpdir({
    sources: ["specs"],
    files: {
      "specs/README.md": ["---", ...frontmatter, "---", "", "# Spec"].join("\n"),
      "specs/doc.md": "# Doc",
      ...files,
    },
  });
  cleanups.push(cleanup);

  return ReviewSubject.resolve({ targetPath: abs("specs/doc.md"), root });
}

describe("assistProvenance", () => {
  it("records each exemplar's path with an 8-char content hash", () => {
    const subject = subjectWith(["exemplars:", '  - "src/*.ts"'], { "src/a.ts": "A" });

    const { exemplarFiles } = subject.assistProvenance();

    expect(exemplarFiles).toHaveLength(1);
    expect(exemplarFiles[0].path).toBe("src/a.ts");
    expect(exemplarFiles[0].hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it("hashes identical content to the same value regardless of path", () => {
    const subject = subjectWith(["exemplars:", '  - "src/*.ts"'], {
      "src/a.ts": "same",
      "src/b.ts": "same",
    });

    const { exemplarFiles } = subject.assistProvenance();

    expect(exemplarFiles[0].hash).toBe(exemplarFiles[1].hash);
  });

  it("keeps exemplars and context in separate records", () => {
    const subject = subjectWith(
      ["exemplars:", '  - "src/good.ts"', "context:", '  - "src/store.ts"'],
      { "src/good.ts": "GOOD", "src/store.ts": "STORE" },
    );

    const { exemplarFiles, contextFiles } = subject.assistProvenance();

    expect(exemplarFiles.map((f) => f.path)).toEqual(["src/good.ts"]);
    expect(contextFiles.map((f) => f.path)).toEqual(["src/store.ts"]);
  });

  it("records nothing for a spec declaring no assist keys", () => {
    const subject = subjectWith(["paths:", '  - "specs/*.md"']);

    expect(subject.assistProvenance()).toEqual({ exemplarFiles: [], contextFiles: [] });
  });
});

describe("assist", () => {
  it("resolves an exemplar glob to its file contents", () => {
    const subject = subjectWith(["exemplars:", '  - "src/*.ts"'], {
      "src/good.ts": "export const good = 1;",
    });

    expect(subject.assist.exemplars).toEqual([
      { path: "src/good.ts", content: "export const good = 1;" },
    ]);
  });

  it("sorts resolved files so the content hash is deterministic", () => {
    const subject = subjectWith(["exemplars:", '  - "src/*.ts"'], {
      "src/c.ts": "c",
      "src/a.ts": "a",
      "src/b.ts": "b",
    });

    const exemplarPaths = subject.assist.exemplars.map((f) => f.path);

    expect(exemplarPaths).toEqual(["src/a.ts", "src/b.ts", "src/c.ts"]);
  });

  it("resolves a glob matching nothing to an empty list", () => {
    const subject = subjectWith(["exemplars:", '  - "src/nope-*.ts"']);

    expect(subject.assist.exemplars).toEqual([]);
  });

  it("raises when a key is declared and no root can resolve it", () => {
    const { abs, cleanup } = createValidatorTmpdir({
      sources: ["specs"],
      files: {
        "specs/README.md": ["---", "exemplars:", '  - "src/*.ts"', "---", "", "# Spec"].join("\n"),
        "specs/doc.md": "# Doc",
      },
    });
    cleanups.push(cleanup);

    const resolveWithoutRoot = () => ReviewSubject.resolve({ targetPath: abs("specs/doc.md") });

    expect(resolveWithoutRoot).toThrow(/declares "exemplars" but no project root/);
  });

  it("does not raise without a root when neither key is declared", () => {
    const { abs, cleanup } = createValidatorTmpdir({
      sources: ["specs"],
      files: {
        "specs/README.md": "# Spec",
        "specs/doc.md": "# Doc",
      },
    });
    cleanups.push(cleanup);

    const subject = ReviewSubject.resolve({ targetPath: abs("specs/doc.md") });

    expect(subject.assist).toEqual({ exemplars: [], context: [] });
  });
});

describe("contentHash", () => {
  it("is the first 8 characters of a SHA256 hex digest", () => {
    const subject = subjectWith(["paths:", '  - "specs/*.md"']);

    expect(subject.contentHash()).toMatch(/^[a-f0-9]{8}$/);
  });

  it("changes when the target changes", () => {
    const before = subjectWith(["paths:", '  - "specs/*.md"']);
    const after = subjectWith(["paths:", '  - "specs/*.md"'], { "specs/doc.md": "# Edited" });

    expect(before.contentHash()).not.toBe(after.contentHash());
  });

  it("changes when the spec changes", () => {
    const before = subjectWith(["paths:", '  - "specs/*.md"']);
    const after = subjectWith(["paths:", '  - "specs/**/*.md"']);

    expect(before.contentHash()).not.toBe(after.contentHash());
  });

  it("is unchanged by a spec that declares no assist inputs", () => {
    const plain = subjectWith(["paths:", '  - "specs/*.md"']);
    const alsoPlain = subjectWith(["paths:", '  - "specs/*.md"']);

    expect(plain.contentHash()).toBe(alsoPlain.contentHash());
  });

  it("changes when an exemplar's content changes", () => {
    const before = subjectWith(["exemplars:", '  - "src/a.ts"'], { "src/a.ts": "A" });
    const after = subjectWith(["exemplars:", '  - "src/a.ts"'], { "src/a.ts": "EDITED" });

    expect(before.contentHash()).not.toBe(after.contentHash());
  });

  it("distinguishes the same file used as exemplar versus context", () => {
    const asExemplar = subjectWith(["exemplars:", '  - "src/a.ts"'], { "src/a.ts": "A" });
    const asContext = subjectWith(["context:", '  - "src/a.ts"'], { "src/a.ts": "A" });

    expect(asExemplar.contentHash()).not.toBe(asContext.contentHash());
  });

  it("distinguishes identical content at different paths", () => {
    const here = subjectWith(["exemplars:", '  - "src/a.ts"'], { "src/a.ts": "X" });
    const there = subjectWith(["exemplars:", '  - "src/b.ts"'], { "src/b.ts": "X" });

    expect(here.contentHash()).not.toBe(there.contentHash());
  });
});

describe("ledger provenance hashes", () => {
  it("hashes target and spec separately, 8 hex chars each", () => {
    const subject = subjectWith(["paths:", '  - "specs/*.md"']);

    expect(subject.targetContentHash()).toMatch(/^[0-9a-f]{8}$/);
    expect(subject.specContentHash()).toMatch(/^[0-9a-f]{8}$/);
    expect(subject.targetContentHash()).not.toBe(subject.specContentHash());
  });

  it("keeps the combined contentHash byte-identical to before the split (cache pin)", () => {
    const subject = subjectWith(["paths:", '  - "specs/*.md"']);

    // sha256("# Doc" + spec text + "")[0:8] — the cache key every committed
    // verdict is stored under. If this assertion breaks, every user's cache
    // misses: that is an epoch roll and must be deliberate.
    expect(subject.contentHash()).toBe(
      createHash("sha256")
        .update("# Doc" + ["---", "paths:", '  - "specs/*.md"', "---", "", "# Spec"].join("\n"))
        .digest("hex")
        .slice(0, 8),
    );
  });
});
