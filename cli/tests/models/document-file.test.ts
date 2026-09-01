import { describe, expect, it } from "vitest";

import { DocumentFile } from "@/models/document-file.js";

/** Builds a document from frontmatter lines, without touching the filesystem. */
function doc(lines: string[], path = "/project/practices/services.md"): DocumentFile {
  const content = ["---", ...lines, "---", "", "# Body"].join("\n");
  return DocumentFile.fromContent(content, path);
}

describe("DocumentFile", () => {
  it("reads type and owner when present", () => {
    const subject = doc(["type: practice", "owner: Scooper"]);

    expect(subject.type).toBe("practice");
    expect(subject.owner).toBe("Scooper");
  });

  it("leaves both undefined when absent", () => {
    const subject = doc(["title: Untyped"]);

    expect(subject.type).toBeUndefined();
    expect(subject.owner).toBeUndefined();
  });

  it("reads a document that no specific model would accept", () => {
    const subject = doc(["type: reference"]);

    expect(subject.type).toBe("reference");
  });

  it("raises when owner is present but not a string", () => {
    const build = () => doc(["type: practice", "owner:", "  - Scooper"]);

    expect(build).toThrow(/Invalid "owner"/);
  });
});
