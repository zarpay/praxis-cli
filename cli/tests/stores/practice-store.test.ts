import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

  describe("add", () => {
    it("scaffolds a practice from its template, placeholders filled", () => {
      const created = store.add("review-pull-requests", tmpdir());

      const content = readFileSync(join(practicesDir, "review-pull-requests.md"), "utf-8");

      expect(created.type).toBe("practice");
      expect(content).toContain('title: "Review Pull Requests"');
      expect(content).toContain("# Review Pull Requests");
    });

    it("refuses to overwrite an existing document", () => {
      const existing = join(practicesDir, "existing.md");
      writeFileSync(existing, "# My custom content\n");

      expect(() => store.add("existing", tmpdir())).toThrow("File already exists");
      expect(readFileSync(existing, "utf-8")).toBe("# My custom content\n");
    });
  });

  describe("orphans", () => {
    it("names the practices no expert references", () => {
      writeFileSync(join(practicesDir, "in-force.md"), practiceContent("In Force"));
      writeFileSync(join(practicesDir, "orphaned.md"), practiceContent("Orphaned"));
      const inForce = join(practicesDir, "in-force.md").slice(tmpdir().length + 1);

      const orphans = store.orphans(new Set([inForce]), tmpdir());

      expect(orphans).toEqual(["orphaned.md"]);
    });
  });
});
