import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import derivePopulationService from "@/services/derive-population-service.js";
import { testConfig } from "@tests/helpers/test-config.js";

/** Runs git quietly in the test repo, with a controllable commit date. */
function git(root: string, env: Record<string, string>, ...args: string[]): void {
  execFileSync("git", args, { cwd: root, env: { ...process.env, ...env } });
}

describe("derivePopulationService", () => {
  let root: string;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-population-test-${randomUUID()}`);
    mkdirSync(root, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /** Commits one file with the given author/committer date. */
  function commitFile(path: string, date: string): void {
    writeFileSync(join(root, path), `content of ${path}\n`);
    const env = {
      GIT_AUTHOR_DATE: `${date}T10:00:00Z`,
      GIT_COMMITTER_DATE: `${date}T10:00:00Z`,
      GIT_AUTHOR_NAME: "Test",
      GIT_AUTHOR_EMAIL: "t@example.com",
      GIT_COMMITTER_NAME: "Test",
      GIT_COMMITTER_EMAIL: "t@example.com",
    };
    git(root, env, "add", "-A");
    git(root, env, "commit", "-qm", `add ${path}`);
  }

  it("classifies by the file's first commit against the axiom's clock", () => {
    git(root, {}, "init", "-q", "-b", "main");
    commitFile("old.ts", "2026-01-15");
    commitFile("new.ts", "2026-09-01");
    const birthdates = new Map<string, string | null>();

    const old = derivePopulationService(testConfig(root), {
      filePath: "old.ts",
      axiomIntroduced: "2026-06-01",
      birthdates,
    });
    const fresh = derivePopulationService(testConfig(root), {
      filePath: "new.ts",
      axiomIntroduced: "2026-06-01",
      birthdates,
    });

    expect(old).toBe("pre_spec");
    expect(fresh).toBe("post_spec");
  });

  it("is per-axiom: one file, two clocks, two populations (01)", () => {
    git(root, {}, "init", "-q", "-b", "main");
    commitFile("doc.ts", "2026-05-01");
    const birthdates = new Map<string, string | null>();

    const underOldAxiom = derivePopulationService(testConfig(root), {
      filePath: "doc.ts",
      axiomIntroduced: "2026-04-01",
      birthdates,
    });
    const underNewAxiom = derivePopulationService(testConfig(root), {
      filePath: "doc.ts",
      axiomIntroduced: "2026-06-01",
      birthdates,
    });

    expect(underOldAxiom).toBe("post_spec");
    expect(underNewAxiom).toBe("pre_spec");
  });

  it("answers unknown outside git — never guessed", () => {
    const population = derivePopulationService(testConfig(root), {
      filePath: "doc.ts",
      axiomIntroduced: "2026-06-01",
      birthdates: new Map(),
    });

    expect(population).toBe("unknown");
  });

  it("memoizes birthdates across calls in one report build", () => {
    git(root, {}, "init", "-q", "-b", "main");
    commitFile("doc.ts", "2026-05-01");
    const birthdates = new Map<string, string | null>();

    derivePopulationService(testConfig(root), {
      filePath: "doc.ts",
      axiomIntroduced: "2026-06-01",
      birthdates,
    });

    expect(birthdates.get("doc.ts")).toBe("2026-05-01");
  });
});
