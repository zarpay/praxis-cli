import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PraxisConfig } from "@/models/praxis-config.js";
import buildStatusReportService from "@/services/build-status-report-service.js";
import countStatusIssuesService from "@/services/count-status-issues-service.js";
import { createCompilerTmpdir } from "@tests/helpers/compiler-tmpdir.js";
import { createValidatorTmpdir } from "@tests/helpers/validator-tmpdir.js";

describe("buildStatusReportService", () => {
  let tmpdir: string;
  let cleanup: () => void;
  /** The report for a project root, read fresh from its config file. */
  const reportFor = (root: string) =>
    buildStatusReportService({ root, config: new PraxisConfig(root) });

  beforeEach(() => {
    const dir = createCompilerTmpdir();
    tmpdir = dir.tmpdir;
    cleanup = dir.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  it("counts roles, responsibilities, references, and context", async () => {
    const report = await reportFor(tmpdir);

    expect(report.counts.experts).toBeGreaterThanOrEqual(1);
    expect(report.counts.practices).toBeGreaterThanOrEqual(1);
    expect(report.counts.references).toBeGreaterThanOrEqual(1);
    expect(report.counts.context).toBeGreaterThanOrEqual(2); // identity.md, principles.md, documentation.md
  });

  it("excludes _template.md and README.md from counts", async () => {
    const report = await reportFor(tmpdir);

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

    const report = await reportFor(tmpdir);

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

    const report = await reportFor(tmpdir);

    expect(report.orphanedPractices).toContain("orphan.md");
  });

  it("detects roles missing description", async () => {
    writeFileSync(
      join(tmpdir, "content", "experts", "no-desc.md"),
      "---\nalias: NoDesc\n---\n# No Description",
    );

    const report = await reportFor(tmpdir);

    expect(report.expertsMissingDescription).toContain("no-desc.md");
  });

  it("counts a malformed expert as a structural issue", async () => {
    writeFileSync(
      join(tmpdir, "content", "experts", "broken.md"),
      "---\ntitle: Broken\n---\n# No Alias",
    );

    const report = await reportFor(tmpdir);

    // It is reported in the output, so it must also fail the exit code —
    // otherwise CI passes on a project the compiler cannot read.
    expect(countStatusIssuesService(report)).toBeGreaterThan(0);
  });

  it("reports a malformed expert instead of dying on it", async () => {
    writeFileSync(
      join(tmpdir, "content", "experts", "broken.md"),
      "---\ntitle: Broken\n---\n# No Alias",
    );

    const report = await reportFor(tmpdir);
    const broken = report.invalidExperts.find((e) => e.expert === "broken.md");

    expect(broken?.reason).toContain('missing required frontmatter field "alias"');
  });

  it("still audits the other experts when one is malformed", async () => {
    writeFileSync(
      join(tmpdir, "content", "experts", "broken.md"),
      "---\ncohort: by_magic\nalias: Broken\n---\n# Broken",
    );
    writeFileSync(join(tmpdir, "content", "experts", "fine.md"), "---\nalias: Fine\n---\n# Fine");

    const report = await reportFor(tmpdir);

    expect(report.invalidExperts.map((e) => e.expert)).toContain("broken.md");
    expect(report.expertsMissingDescription).toContain("fine.md");
  });

  it("detects zero-match glob patterns", async () => {
    writeFileSync(
      join(tmpdir, "content", "experts", "bad-glob.md"),
      "---\nalias: BadGlob\ndescription: test\nrefs:\n  - content/reference/nope-*.md\n---\n# Bad",
    );

    const report = await reportFor(tmpdir);

    expect(report.zeroMatchGlobs).toContainEqual({
      expert: "bad-glob.md",
      pattern: "content/reference/nope-*.md",
    });
  });

  it("excludes files matching ignore patterns from source counts", async () => {
    // Baseline first: a context reads the config file lazily, so this must
    // be taken before the ignore pattern is written.
    const baseReport = await reportFor(tmpdir);

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
    // validates-expert.md is in the experts dir but should be excluded
    const report = await reportFor(tmpdir);

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

    const report = await reportFor(root);

    // One validation row per configured reviewer (the legacy validation
    // section normalizes to one reviewer named "default"); both .rb files
    // appear as not-validated in its cache coverage.
    expect(report.validation).toEqual([
      { reviewer: "test", pass: 0, warn: 0, fail: 0, notValidated: 2 },
    ]);

    cleanup();
  });

  it("reports clean for a healthy project", async () => {
    const report = await reportFor(tmpdir);

    // The default fixtures form a healthy project
    expect(report.danglingRefs).toEqual([]);
    expect(report.expertsMissingDescription).toEqual([]);
    expect(report.zeroMatchGlobs).toEqual([]);
  });

  describe("layer split", () => {
    it("marks the compiler in use when the experts directory exists", async () => {
      const report = await reportFor(tmpdir);

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

      const report = await reportFor(root);

      expect(report.compilerInUse).toBe(false);
      expect(report.counts).toEqual({ experts: 0, practices: 0, references: 0, context: 0 });
      expect(report.orphanedPractices).toEqual([]);
      expect(countStatusIssuesService(report)).toBe(0);

      cleanup();
    });

    it("still tallies validation state for an eval-only project", async () => {
      const { root, cleanup } = createValidatorTmpdir({
        sources: ["docs"],
        files: {
          "docs/README.md": "# Spec",
          "docs/guide.md": "# Guide",
        },
        reviewers: [{ name: "test", model: "test-model", apiKeyEnvVar: "OPENROUTER_API_KEY" }],
      });

      const report = await reportFor(root);

      expect(report.validation).toHaveLength(1);
      expect(report.validation[0]).toMatchObject({ reviewer: "test", notValidated: 1 });

      cleanup();
    });
  });
});
