import { afterEach, describe, expect, it } from "vitest";

import { ReviewSubject } from "@/domains/eval/models/review-subject.js";
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
