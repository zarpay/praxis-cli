import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import compileExpertService from "@/services/compile-expert-service.js";
import { testConfig } from "@tests/helpers/test-config.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

/** An expert document with the given frontmatter and body. */
function expert(frontmatter: string, body = "What the expert does.\n"): string {
  return `---\n${frontmatter}\n---\n\n${body}`;
}

/** Compiles the single expert in a project built from `files`. */
async function compile(files: Record<string, string>) {
  const { root, cleanup } = createValidatorTmpdir({ sources: ["knowledge"], files });
  cleanups.push(cleanup);

  const cfg = testConfig(root, {
    sources: ["knowledge"],
    agentProfilesOutputDir: "./agent-profiles",
  });
  const result = await compileExpertService(cfg, {
    expertFile: join(root, "knowledge/experts/steward.md"),
    plugins: [],
  });

  return { root, result };
}

/** The compiled profile written for an alias. */
function profileFor(root: string, alias: string): string {
  return readFileSync(join(root, "agent-profiles", `${alias}.expert.md`), "utf8");
}

describe("compileExpertService", () => {
  it("compiles the expert's own body into the profile", async () => {
    const { root, result } = await compile({
      "knowledge/experts/steward.md": expert(
        'title: S\ntype: expert\nalias: Scooper\ndescription: "d"',
        "The steward reviews services.\n",
      ),
    });

    expect(result.alias).toBe("Scooper");
    expect(profileFor(root, "scooper")).toContain("The steward reviews services.");
  });

  it("inlines what the expert references, so the profile stands alone", async () => {
    const { root } = await compile({
      "knowledge/context/rules.md": "# Rules\n\nAlways return a Result.\n",
      "knowledge/experts/steward.md": expert(
        'title: S\ntype: expert\nalias: S\ndescription: "d"\ncontext:\n  - knowledge/context/rules.md',
      ),
    });

    expect(profileFor(root, "s")).toContain("Always return a Result.");
  });

  it("warns about a reference that is not there rather than abandoning the profile", async () => {
    const { root, result } = await compile({
      "knowledge/experts/steward.md": expert(
        'title: S\ntype: expert\nalias: S\ndescription: "d"\ncontext:\n  - knowledge/context/gone.md',
      ),
    });

    // A typo'd reference should not cost the author the rest of the
    // profile — but they still have to hear about it.
    expect(result.warnings.join(" ")).toContain("gone.md");
    expect(existsSync(join(root, "agent-profiles", "s.expert.md"))).toBe(true);
  });

  it("compiles an expert with no description, and says why it is not dispatchable", async () => {
    const { root, result } = await compile({
      "knowledge/experts/steward.md": expert("title: S\ntype: expert\nalias: S"),
    });

    expect(result.warnings.join(" ")).toContain("skipping agent metadata");
    // Readable, just not dispatchable: no targeting frontmatter.
    expect(profileFor(root, "s").startsWith("---")).toBe(false);
  });

  it("raises on a document that is not a valid expert", async () => {
    const attempt = compile({ "knowledge/experts/steward.md": "no frontmatter\n" });

    await expect(attempt).rejects.toThrow();
  });

  it("keeps references in declaration order", async () => {
    const { root } = await compile({
      "knowledge/context/first.md": "# One\n\nFIRST\n",
      "knowledge/context/second.md": "# Two\n\nSECOND\n",
      "knowledge/experts/steward.md": expert(
        'title: S\ntype: expert\nalias: S\ndescription: "d"\ncontext:\n  - knowledge/context/second.md\n  - knowledge/context/first.md',
      ),
    });
    const profile = profileFor(root, "s");

    expect(profile.indexOf("SECOND")).toBeLessThan(profile.indexOf("FIRST"));
  });
});
