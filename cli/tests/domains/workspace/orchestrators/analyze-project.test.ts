import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PraxisConfig } from "@/domains/workspace/models/praxis-config.js";
import analyzeProject from "@/domains/workspace/orchestrators/analyze-project.js";
import countStatusIssues from "@/domains/workspace/services/count-status-issues.js";
import { createCompilerTmpdir } from "@tests/helpers/compiler-tmpdir.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

describe("analyzeProject", () => {
  let tmpdir: string;
  let cleanup: () => void;
  let config: PraxisConfig;

  beforeEach(() => {
    const ctx = createCompilerTmpdir();
    tmpdir = ctx.tmpdir;
    cleanup = ctx.cleanup;
    config = new PraxisConfig(tmpdir);
  });

  afterEach(() => {
    cleanup();
  });

  it("counts roles, responsibilities, references, and context", async () => {
    const report = await analyzeProject({ root: tmpdir, config });

    expect(report.counts.experts).toBeGreaterThanOrEqual(1);
    expect(report.counts.practices).toBeGreaterThanOrEqual(1);
    expect(report.counts.references).toBeGreaterThanOrEqual(1);
    expect(report.counts.context).toBeGreaterThanOrEqual(2); // identity.md, principles.md, documentation.md
  });

  it("excludes _template.md and README.md from counts", async () => {
    const report = await analyzeProject({ root: tmpdir, config });

    // Roles dir has README.md + content files; reported count must be less than total .md files
    const allRoleFiles = readdirSync(join(tmpdir, "content", "experts")).filter((f) =>
      f.endsWith(".md"),
    );
    expect(report.counts.experts).toBeLessThan(allRoleFiles.length);
  });

  it("detects dangling refs", async () => {
    writeFileSync(
      join(tmpdir, "content", "experts", "bad-refs.md"),
      "---\nalias: BadRefs\ndescription: test\nrefs:\n  - content/reference/nonexistent.md\n---\n# Bad",
    );

    const report = await analyzeProject({ root: tmpdir, config });

    expect(report.danglingRefs).toContainEqual({
      expert: "bad-refs.md",
      ref: "content/reference/nonexistent.md",
    });
  });

  it("detects orphaned responsibilities", async () => {
    writeFileSync(
      join(tmpdir, "content", "practices", "orphan.md"),
      "---\ntitle: Orphan\ntype: practice\nowner: nobody\n---\n# Orphan",
    );

    const report = await analyzeProject({ root: tmpdir, config });

    expect(report.orphanedPractices).toContain("orphan.md");
  });

  it("detects roles missing description", async () => {
    writeFileSync(
      join(tmpdir, "content", "experts", "no-desc.md"),
      "---\nalias: NoDesc\n---\n# No Description",
    );

    const report = await analyzeProject({ root: tmpdir, config });

    expect(report.expertsMissingDescription).toContain("no-desc.md");
  });

  it("counts a malformed expert as a structural issue", async () => {
    writeFileSync(
      join(tmpdir, "content", "experts", "broken.md"),
      "---\ntitle: Broken\n---\n# No Alias",
    );

    const report = await analyzeProject({ root: tmpdir, config });

    // It is reported in the output, so it must also fail the exit code —
    // otherwise CI passes on a project the compiler cannot read.
    expect(countStatusIssues(report)).toBeGreaterThan(0);
  });

  it("reports a malformed expert instead of dying on it", async () => {
    writeFileSync(
      join(tmpdir, "content", "experts", "broken.md"),
      "---\ntitle: Broken\n---\n# No Alias",
    );

    const report = await analyzeProject({ root: tmpdir, config });
    const broken = report.invalidExperts.find((e) => e.expert === "broken.md");

    expect(broken?.reason).toContain('missing required frontmatter field "alias"');
  });

  it("still audits the other experts when one is malformed", async () => {
    writeFileSync(
      join(tmpdir, "content", "experts", "broken.md"),
      "---\ncohort: by_magic\nalias: Broken\n---\n# Broken",
    );
    writeFileSync(join(tmpdir, "content", "experts", "fine.md"), "---\nalias: Fine\n---\n# Fine");

    const report = await analyzeProject({ root: tmpdir, config });

    expect(report.invalidExperts.map((e) => e.expert)).toContain("broken.md");
    expect(report.expertsMissingDescription).toContain("fine.md");
  });

  it("detects zero-match glob patterns", async () => {
    writeFileSync(
      join(tmpdir, "content", "experts", "bad-glob.md"),
      "---\nalias: BadGlob\ndescription: test\nrefs:\n  - content/reference/nope-*.md\n---\n# Bad",
    );

    const report = await analyzeProject({ root: tmpdir, config });

    expect(report.zeroMatchGlobs).toContainEqual({
      expert: "bad-glob.md",
      pattern: "content/reference/nope-*.md",
    });
  });

  it("detects unmatched owners", async () => {
    writeFileSync(
      join(tmpdir, "content", "practices", "unmatched.md"),
      "---\ntitle: Unmatched\ntype: practice\nowner: phantom-role\n---\n# Unmatched",
    );

    const report = await analyzeProject({ root: tmpdir, config });

    expect(report.unmatchedOwners).toContainEqual({
      practice: "unmatched.md",
      owner: "phantom-role",
    });
  });

  it("excludes files matching ignore patterns from source counts", async () => {
    writeFileSync(
      join(tmpdir, ".praxis", "config.json"),
      JSON.stringify({
        sources: ["content/experts", "content/practices", "content/reference", "content/context"],
        expertsDir: "content/experts",
        practicesDir: "content/practices",
        agentProfilesOutputDir: "./agent-profiles",
        plugins: ["claude-code"],
        ignore: ["content/experts/validates-expert.md"],
      }),
    );
    const ignoringConfig = new PraxisConfig(tmpdir);
    const report = await analyzeProject({ root: tmpdir, config: ignoringConfig });

    // validates-role.md is in the roles dir but should be excluded
    const baseReport = await analyzeProject({ root: tmpdir, config });
    expect(report.counts.experts).toBe(baseReport.counts.experts - 1);
  });

  it("counts non-.md validation targets from spec paths: frontmatter", async () => {
    const { root, cleanup } = createValidatorTmpdir({
      sources: ["docs"],
      files: {
        // Spec targets .rb files via paths:
        "docs/events.sme.md":
          '---\npaths:\n  - "src/**/*.rb"\n---\n# Spec\nAll Ruby files need a comment.',
        "src/account_event.rb": "# AccountEvent",
        "src/user_event.rb": "# UserEvent",
      },
      specFilePattern: "*.sme.md",
    });

    const nonMdConfig = new PraxisConfig(root);
    const report = await analyzeProject({ root, config: nonMdConfig });

    // One validation row per configured judge (the legacy validation
    // section normalizes to one judge named "default"); both .rb files
    // appear as not-validated in its cache coverage.
    expect(report.validation).toEqual([
      { judge: "test", pass: 0, warn: 0, fail: 0, notValidated: 2 },
    ]);

    cleanup();
  });

  it("reports clean for a healthy project", async () => {
    const report = await analyzeProject({ root: tmpdir, config });

    // The default fixtures form a healthy project
    expect(report.danglingRefs).toEqual([]);
    expect(report.expertsMissingDescription).toEqual([]);
    expect(report.zeroMatchGlobs).toEqual([]);
  });

  describe("layer split", () => {
    it("marks the compiler in use when the experts directory exists", async () => {
      const report = await analyzeProject({ root: tmpdir, config });

      expect(report.compilerInUse).toBe(true);
    });

    it("skips framework health entirely for an eval-only project", async () => {
      const { root, cleanup } = createValidatorTmpdir({
        sources: ["docs"],
        files: {
          "docs/README.md": "# Spec",
          "docs/guide.md": "# Guide",
          // An orphaned-looking practice that must NOT be reported:
          // framework health is off when no experts directory exists.
          "docs/stray-practice.md": "---\nowner: nobody\n---\n# Stray",
        },
      });

      const report = await analyzeProject({ root, config: new PraxisConfig(root) });

      expect(report.compilerInUse).toBe(false);
      expect(report.counts).toEqual({ experts: 0, practices: 0, references: 0, context: 0 });
      expect(report.unmatchedOwners).toEqual([]);
      expect(report.orphanedPractices).toEqual([]);
      expect(countStatusIssues(report)).toBe(0);

      cleanup();
    });

    it("still tallies validation state for an eval-only project", async () => {
      const { root, cleanup } = createValidatorTmpdir({
        sources: ["docs"],
        files: {
          "docs/README.md": "# Spec",
          "docs/guide.md": "# Guide",
        },
        judges: [{ name: "test", model: "test-model", apiKeyEnvVar: "OPENROUTER_API_KEY" }],
      });

      const report = await analyzeProject({ root, config: new PraxisConfig(root) });

      expect(report.validation).toHaveLength(1);
      expect(report.validation[0]).toMatchObject({ judge: "test", notValidated: 1 });

      cleanup();
    });
  });
});
