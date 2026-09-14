import { afterEach, describe, expect, it } from "vitest";

import auditExpertsService from "@/services/audit-experts-service.js";
import { testConfig } from "@tests/helpers/test-config.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

/** An expert document with the given frontmatter body. */
function expert(frontmatter: string): string {
  return `---\n${frontmatter}\n---\n\n# Expert\n\nBody.\n`;
}

/** The audit of every expert in a project built from `files`. */
async function audit(files: Record<string, string>) {
  const { root, cleanup } = createValidatorTmpdir({ sources: ["knowledge"], files });
  cleanups.push(cleanup);

  const expertFiles = Object.keys(files)
    .filter((path) => path.startsWith("knowledge/experts/"))
    .map((path) => `${root}/${path}`);

  return await auditExpertsService(testConfig(root, { sources: ["knowledge"] }), { expertFiles });
}

describe("auditExpertsService", () => {
  it("maps each expert's alias, lowercased, to its filename", async () => {
    const result = await audit({
      "knowledge/experts/steward.md": expert(
        'title: S\ntype: expert\nalias: Scooper\ndescription: "Does things."',
      ),
    });

    expect(result.aliases.get("scooper")).toBe("steward.md");
  });

  it("records an expert that will not parse instead of raising", async () => {
    // Project health is exactly the report you want when a document is
    // broken — a throw would hide every other finding.
    const result = await audit({
      "knowledge/experts/broken.md": "no frontmatter at all\n",
      "knowledge/experts/fine.md": expert(
        'title: F\ntype: expert\nalias: Fine\ndescription: "Ok."',
      ),
    });

    expect(result.invalidExperts).toHaveLength(1);
    expect(result.invalidExperts[0]?.expert).toBe("broken.md");
    expect(result.aliases.get("fine")).toBe("fine.md");
  });

  it("names an expert that declares no description", async () => {
    const result = await audit({
      "knowledge/experts/quiet.md": expert("title: Q\ntype: expert\nalias: Quiet"),
    });

    expect(result.missingDescriptions).toEqual(["quiet.md"]);
  });

  it("reports a plain reference to a file that does not exist as dangling", async () => {
    const result = await audit({
      "knowledge/experts/steward.md": expert(
        'title: S\ntype: expert\nalias: S\ndescription: "d"\ncontext:\n  - knowledge/context/missing.md',
      ),
    });

    expect(result.danglingRefs).toEqual([
      { expert: "steward.md", ref: "knowledge/context/missing.md" },
    ]);
    expect(result.zeroMatchGlobs).toEqual([]);
  });

  it("reports a glob matching nothing as a zero-match, not as dangling", async () => {
    // The distinction is what makes each finding actionable: a glob that
    // matches nothing is a typo; a plain path that is absent is a gap.
    const result = await audit({
      "knowledge/experts/steward.md": expert(
        'title: S\ntype: expert\nalias: S\ndescription: "d"\ncontext:\n  - "knowledge/context/*.md"',
      ),
    });

    expect(result.zeroMatchGlobs).toEqual([
      { expert: "steward.md", pattern: "knowledge/context/*.md" },
    ]);
    expect(result.danglingRefs).toEqual([]);
  });

  it("collects the practices experts actually point at", async () => {
    const result = await audit({
      "knowledge/practices/review.md": "# Practice\n",
      "knowledge/experts/steward.md": expert(
        'title: S\ntype: expert\nalias: S\ndescription: "d"\npractices:\n  - knowledge/practices/review.md',
      ),
    });

    expect([...result.referencedPractices]).toHaveLength(1);
    expect([...result.referencedPractices][0]).toContain("review.md");
  });

  it("reports an empty audit for a project with no experts", async () => {
    const result = await audit({ "knowledge/practices/only.md": "# P\n" });

    expect(result.aliases.size).toBe(0);
    expect(result.invalidExperts).toEqual([]);
    expect(result.danglingRefs).toEqual([]);
  });
});
