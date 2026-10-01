import type { ValidationDomain } from "@/types.js";

import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CommandContext } from "@/models/command-context.js";
import { PraxisConfig } from "@/models/praxis-config.js";
import { initProjectOrchestrator } from "@/orchestrators/init-project-orchestrator.js";
import compileExpertsService from "@/services/compile-experts-service.js";
import discoverDomainsService from "@/services/discover-domains-service.js";

/** Resolved path to the scaffold directory at the project root. */
const SCAFFOLD_DIR = join(import.meta.dirname, "..", "..", "scaffold");

/**
 * Integration test: init → compile → discover.
 *
 * The scaffold's recruiter declares `validates:` over the experts and
 * practices directories, so its compiled profile must come back from
 * spec discovery as a domain whose targets are the other definitions.
 * Three scaffold facts have to agree for that to hold — the profiles
 * directory is a source, the spec pattern accepts `*.expert.md`, and
 * the recruiter's globs name the right directories — and no unit test pins the
 * chain. This one does, offline and against the real scaffold.
 */
describe("the recruiter reviews the experts and practices", () => {
  let dir: string;
  let recruiter: ValidationDomain | undefined;
  let steward: ValidationDomain | undefined;

  /** A domain's targets as project-relative paths, sorted. */
  const targetsOf = (domain: ValidationDomain | undefined): string[] =>
    (domain?.targetFiles ?? []).map((path) => path.slice(dir.length + 1)).sort();

  beforeAll(async () => {
    dir = join(tmpdir(), `praxis-recruiter-${randomUUID()}`);

    await initProjectOrchestrator(new CommandContext(), {
      directory: dir,
      scaffoldDir: SCAFFOLD_DIR,
      specLayer: true,
    });

    const cfg = new PraxisConfig(dir);

    await compileExpertsService(cfg, { plugins: [] });

    const domains = discoverDomainsService(cfg, {});
    recruiter = domains.find((domain) => domain.type === "praxis-recruiter");
    steward = domains.find((domain) => domain.type === "praxis-steward");
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("compiles the recruiter into a spec that discovery finds under its alias", () => {
    expect(recruiter).toBeDefined();
    expect(recruiter?.specPath).toBe(join(dir, "agent-profiles", "praxis-recruiter.expert.md"));
  });

  it("governs every expert and practice definition, including the recruiter's own source", () => {
    expect(targetsOf(recruiter)).toEqual([
      "experts/praxis-recruiter.md",
      "experts/praxis-steward.md",
      "practices/audit-framework-health.md",
      "practices/challenge-contributor-design.md",
      "practices/guide-content-placement.md",
      "practices/review-content-quality.md",
      "practices/review-expert-definition.md",
      "practices/review-practice-definition.md",
    ]);
  });

  it("never hands the reviewer a directory README as a definition", () => {
    const targets = targetsOf(recruiter);

    expect(targets.some((path) => path.endsWith("README.md"))).toBe(false);
  });

  it("compiles the steward into a by_directory spec over the context and reference folders", () => {
    expect(steward?.cohort).toBe("by_directory");
    expect((steward?.targetDirs ?? []).map((path) => path.slice(dir.length + 1)).sort()).toEqual([
      "context/constitution",
      "context/conventions",
      "context/lenses",
      "reference",
    ]);
  });
});
