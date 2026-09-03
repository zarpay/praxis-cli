import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ExpertStore } from "@/stores/expert-store.js";

/** A minimal valid expert document. */
function expertContent(title: string, alias: string): string {
  return [
    "---",
    `title: ${title}`,
    "type: expert",
    `alias: ${alias}`,
    "description: Use this expert in tests.",
    "---",
    "",
    `# ${title}`,
  ].join("\n");
}

describe("ExpertStore", () => {
  let expertsDir: string;
  let store: ExpertStore;

  beforeEach(() => {
    expertsDir = join(tmpdir(), `praxis-expert-store-test-${randomUUID()}`);
    mkdirSync(expertsDir, { recursive: true });
    store = new ExpertStore({ expertsDir, specFilePattern: "README.md" });
  });

  afterEach(() => {
    rmSync(expertsDir, { recursive: true, force: true });
  });

  it("lists nothing for a missing directory — unused taxonomy is normal", () => {
    const empty = new ExpertStore({
      expertsDir: join(expertsDir, "nope"),
      specFilePattern: "README.md",
    });

    expect(empty.files()).toEqual([]);
  });

  it("lists expert documents, never specs or underscore templates", () => {
    writeFileSync(join(expertsDir, "reviewer.md"), expertContent("Reviewer", "Rev"));
    writeFileSync(join(expertsDir, "README.md"), "# The spec");
    writeFileSync(join(expertsDir, "_expert-template.md"), "# Template");

    const files = store.files();

    expect(files).toHaveLength(1);
    expect(files[0]).toContain("reviewer.md");
  });

  it("reports a malformed expert as a problem without hiding the rest", () => {
    writeFileSync(join(expertsDir, "reviewer.md"), expertContent("Reviewer", "Rev"));
    writeFileSync(join(expertsDir, "broken.md"), "---\ntitle: Broken\n---\nno type, no alias");

    const { experts, problems } = store.all();

    expect(experts.map((expert) => expert.alias)).toEqual(["Rev"]);
    expect(problems).toHaveLength(1);
    expect(problems[0].path).toContain("broken.md");
  });

  it("finds an expert by alias, case-insensitively, walking past malformed files", () => {
    writeFileSync(join(expertsDir, "broken.md"), "---\ntitle: Broken\n---\nnot an expert");
    writeFileSync(join(expertsDir, "reviewer.md"), expertContent("Reviewer", "Sundae"));

    const found = store.byAlias("sundae");
    const missing = store.byAlias("nobody");

    expect(found?.alias).toBe("Sundae");
    expect(missing).toBeNull();
  });
});
