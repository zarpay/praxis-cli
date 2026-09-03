import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { gitFacts } from "@/helpers/git-helper.js";

/** Runs git quietly in the test repo. */
function git(root: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

describe("gitFacts", () => {
  let root: string;

  beforeEach(() => {
    root = join(tmpdir(), `praxis-git-helper-test-${randomUUID()}`);
    mkdirSync(root, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /** Initializes a repo with one committed file. */
  function initRepo(): void {
    git(root, "init", "-q", "-b", "main");
    git(root, "config", "user.email", "test@example.com");
    git(root, "config", "user.name", "Test");
    writeFileSync(join(root, "doc.md"), "# Doc\n");
    git(root, "add", "-A");
    git(root, "commit", "-qm", "init");
  }

  it("reports not-in-repo outside git, all facts null", () => {
    expect(gitFacts(root)).toEqual({ inRepo: false, commitSha: null, branch: null });
  });

  it("anchors a clean tree on a branch to its commit", () => {
    initRepo();

    const facts = gitFacts(root);

    expect(facts.inRepo).toBe(true);
    expect(facts.branch).toBe("main");
    expect(facts.commitSha).toMatch(/^[0-9a-f]{40}$/);
  });

  it("keeps the sha when only .praxis/ is dirty — machine bookkeeping is free", () => {
    initRepo();
    mkdirSync(join(root, ".praxis", "cache"), { recursive: true });
    writeFileSync(join(root, ".praxis", "cache", "x.json"), "{}");

    const facts = gitFacts(root);

    expect(facts.commitSha).toMatch(/^[0-9a-f]{40}$/);
  });

  it("withholds the sha from a dirty tree, keeping the branch", () => {
    initRepo();
    writeFileSync(join(root, "doc.md"), "# Changed\n");

    const facts = gitFacts(root);

    expect(facts).toMatchObject({ inRepo: true, commitSha: null, branch: "main" });
  });

  it("withholds sha and branch on a detached HEAD", () => {
    initRepo();
    const sha = git(root, "rev-parse", "HEAD");
    git(root, "checkout", "-q", sha);

    const facts = gitFacts(root);

    expect(facts).toMatchObject({ inRepo: true, commitSha: null, branch: null });
  });
});
