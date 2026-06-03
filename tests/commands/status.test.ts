import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { analyzeProject } from "@/commands/status.js";
import { PraxisConfig } from "@/core/config.js";

import { createCompilerTmpdir } from "../helpers/compiler-tmpdir.js";
import { createValidatorTmpdir } from "../helpers/validator-tmpdir.js";

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
    const report = await analyzeProject(tmpdir, config);

    expect(report.counts.roles).toBeGreaterThanOrEqual(1);
    expect(report.counts.responsibilities).toBeGreaterThanOrEqual(1);
    expect(report.counts.references).toBeGreaterThanOrEqual(1);
    expect(report.counts.context).toBeGreaterThanOrEqual(2); // identity.md, principles.md, documentation.md
  });

  it("excludes _template.md and README.md from counts", async () => {
    const report = await analyzeProject(tmpdir, config);

    // Roles dir has README.md + content files; reported count must be less than total .md files
    const allRoleFiles = readdirSync(join(tmpdir, "content", "roles")).filter((f) =>
      f.endsWith(".md"),
    );
    expect(report.counts.roles).toBeLessThan(allRoleFiles.length);
  });

  it("detects dangling refs", async () => {
    writeFileSync(
      join(tmpdir, "content", "roles", "bad-refs.md"),
      "---\nalias: BadRefs\ndescription: test\nrefs:\n  - content/reference/nonexistent.md\n---\n# Bad",
    );

    const report = await analyzeProject(tmpdir, config);

    expect(report.danglingRefs).toContainEqual({
      role: "bad-refs.md",
      ref: "content/reference/nonexistent.md",
    });
  });

  it("detects orphaned responsibilities", async () => {
    writeFileSync(
      join(tmpdir, "content", "responsibilities", "orphan.md"),
      "---\ntitle: Orphan\ntype: responsibility\nowner: nobody\n---\n# Orphan",
    );

    const report = await analyzeProject(tmpdir, config);

    expect(report.orphanedResponsibilities).toContain("orphan.md");
  });

  it("detects roles missing description", async () => {
    writeFileSync(
      join(tmpdir, "content", "roles", "no-desc.md"),
      "---\nalias: NoDesc\n---\n# No Description",
    );

    const report = await analyzeProject(tmpdir, config);

    expect(report.rolesMissingDescription).toContain("no-desc.md");
  });

  it("detects zero-match glob patterns", async () => {
    writeFileSync(
      join(tmpdir, "content", "roles", "bad-glob.md"),
      "---\nalias: BadGlob\ndescription: test\nrefs:\n  - content/reference/nope-*.md\n---\n# Bad",
    );

    const report = await analyzeProject(tmpdir, config);

    expect(report.zeroMatchGlobs).toContainEqual({
      role: "bad-glob.md",
      pattern: "content/reference/nope-*.md",
    });
  });

  it("detects unmatched owners", async () => {
    writeFileSync(
      join(tmpdir, "content", "responsibilities", "unmatched.md"),
      "---\ntitle: Unmatched\ntype: responsibility\nowner: phantom-role\n---\n# Unmatched",
    );

    const report = await analyzeProject(tmpdir, config);

    expect(report.unmatchedOwners).toContainEqual({
      responsibility: "unmatched.md",
      owner: "phantom-role",
    });
  });

  it("excludes files matching ignore patterns from source counts", async () => {
    writeFileSync(
      join(tmpdir, ".praxis", "config.json"),
      JSON.stringify({
        sources: [
          "content/roles",
          "content/responsibilities",
          "content/reference",
          "content/context",
        ],
        rolesDir: "content/roles",
        responsibilitiesDir: "content/responsibilities",
        agentProfilesOutputDir: "./agent-profiles",
        plugins: ["claude-code"],
        ignore: ["content/roles/validates-role.md"],
      }),
    );
    const ignoringConfig = new PraxisConfig(tmpdir);
    const report = await analyzeProject(tmpdir, ignoringConfig);

    // validates-role.md is in the roles dir but should be excluded
    const baseReport = await analyzeProject(tmpdir, config);
    expect(report.counts.roles).toBe(baseReport.counts.roles - 1);
  });

  it("counts non-.md validation targets from spec paths: frontmatter", async () => {
    const { root, cleanup } = createValidatorTmpdir({
      sources: ["docs"],
      files: {
        // Spec targets .rb files via paths:
        "docs/events.sme.md":
          "---\npaths:\n  - \"src/**/*.rb\"\n---\n# Spec\nAll Ruby files need a comment.",
        "src/account_event.rb": "# AccountEvent",
        "src/user_event.rb": "# UserEvent",
      },
      validation: { apiKeyEnvVar: "OPENROUTER_API_KEY", model: "test", specFilePattern: "*.sme.md" },
    });

    const nonMdConfig = new PraxisConfig(root);
    const report = await analyzeProject(root, nonMdConfig);

    // Both .rb files should appear as not-validated (in cache coverage)
    expect(report.validation.notValidated).toBe(2);
    expect(report.validation.pass + report.validation.warn + report.validation.fail).toBe(0);

    cleanup();
  });

  it("reports clean for a healthy project", async () => {
    const report = await analyzeProject(tmpdir, config);

    // The default fixtures form a healthy project
    expect(report.danglingRefs).toEqual([]);
    expect(report.rolesMissingDescription).toEqual([]);
    expect(report.zeroMatchGlobs).toEqual([]);
  });
});
