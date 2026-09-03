import { describe, expect, it } from "vitest";

import { PracticeFile } from "@/models/practice-file.js";

/** A valid practice document; tests break one thing at a time. */
function practiceContent(overrides: Record<string, string | null> = {}): string {
  const fields: Record<string, string | null> = {
    title: "Review Pull Requests",
    type: "practice",
    ...overrides,
  };

  const frontmatter = Object.entries(fields)
    .filter(([, value]) => value !== null)
    .map(([key, value]) => `${key}: ${value}`);

  return ["---", ...frontmatter, "---", "", "## Objective", "", "Review well."].join("\n");
}

describe("PracticeFile", () => {
  it("reads a valid practice", () => {
    const practice = PracticeFile.fromContent(practiceContent(), "review-prs.md");

    expect(practice.title).toBe("Review Pull Requests");
    expect(practice.body).toContain("## Objective");
  });

  it("rejects a missing title", () => {
    const readUntitled = () => PracticeFile.fromContent(practiceContent({ title: null }), "p.md");

    expect(readUntitled).toThrow(/title/);
  });

  it("rejects a document of another type — an expert is not a practice", () => {
    const readExpert = () => PracticeFile.fromContent(practiceContent({ type: "expert" }), "p.md");

    expect(readExpert).toThrow(/"practice"/);
  });
});
