import { describe, expect, it } from "vitest";

import { DocumentFile } from "@/workspace/models/document-file.js";

/** Builds a document from frontmatter lines, without touching the filesystem. */
function doc(lines: string[], path = "/project/practices/services.md"): DocumentFile {
  const content = ["---", ...lines, "---", "", "# Body"].join("\n");
  return DocumentFile.fromContent(content, path);
}

describe("DocumentFile", () => {
  it("reads type when present", () => {
    const subject = doc(["type: practice"]);

    expect(subject.type).toBe("practice");
  });

  it("leaves type undefined when absent", () => {
    const subject = doc(["title: Untyped"]);

    expect(subject.type).toBeUndefined();
  });

  it("reads a document that no specific model would accept", () => {
    const subject = doc(["type: reference"]);

    expect(subject.type).toBe("reference");
  });
});
