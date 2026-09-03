import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PracticeStore } from "@/stores/practice-store.js";

/** A minimal valid practice document. */
function practiceContent(title: string): string {
  return ["---", `title: ${title}`, "type: practice", "---", "", "## Objective"].join("\n");
}

describe("PracticeStore", () => {
  let practicesDir: string;
  let store: PracticeStore;

  beforeEach(() => {
    practicesDir = join(tmpdir(), `praxis-practice-store-test-${randomUUID()}`);
    mkdirSync(practicesDir, { recursive: true });
    store = new PracticeStore({ practicesDir, specFilePattern: "README.md" });
  });

  afterEach(() => {
    rmSync(practicesDir, { recursive: true, force: true });
  });

  it("lists practice documents, never specs or underscore templates", () => {
    writeFileSync(join(practicesDir, "review-prs.md"), practiceContent("Review PRs"));
    writeFileSync(join(practicesDir, "README.md"), "# The spec");
    writeFileSync(join(practicesDir, "_practice-template.md"), "# Template");

    const files = store.files();

    expect(files).toHaveLength(1);
    expect(files[0]).toContain("review-prs.md");
  });

  it("validates practices and reports the malformed without hiding the rest", () => {
    writeFileSync(join(practicesDir, "review-prs.md"), practiceContent("Review PRs"));
    writeFileSync(join(practicesDir, "broken.md"), "---\ntype: expert\ntitle: X\n---\nwrong kind");

    const { practices, problems } = store.all();

    expect(practices.map((practice) => practice.title)).toEqual(["Review PRs"]);
    expect(problems).toHaveLength(1);
  });
});
