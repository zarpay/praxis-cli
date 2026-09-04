import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  authorsOfRange,
  changedFilesOfRange,
  commitExists,
  defaultBranchRef,
  fileFirstCommitDate,
  gitFacts,
  interventionsFor,
  lastAuthorOfRange,
  mergeBase,
  resolveSha,
  showFileAt,
} from "@/helpers/git-helper.js";

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

  it("commitExists distinguishes reachable from unknown shas", () => {
    initRepo();
    const sha = git(root, "rev-parse", "HEAD");

    expect(gitFacts(root).inRepo).toBe(true);
    expect(commitExists(root, sha)).toBe(true);
    expect(commitExists(root, "0".repeat(40))).toBe(false);
  });

  it("fileFirstCommitDate returns the first-touch date; null when untracked", () => {
    initRepo();
    writeFileSync(join(root, "untracked.md"), "x");

    expect(fileFirstCommitDate(root, "doc.md")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fileFirstCommitDate(root, "untracked.md")).toBeNull();
  });

  it("authorsOfRange names who touched a file between two commits", () => {
    initRepo();
    const from = git(root, "rev-parse", "HEAD");
    writeFileSync(join(root, "doc.md"), "# Changed\n");
    git(root, "add", "-A");
    git(root, "-c", "user.name=Fixer", "-c", "user.email=f@example.com", "commit", "-qm", "fix");
    const to = git(root, "rev-parse", "HEAD");

    expect(authorsOfRange(root, from, to, "doc.md")).toEqual(["Fixer"]);
    expect(authorsOfRange(root, from, to, "other.md")).toEqual([]);
  });

  it("withholds sha and branch on a detached HEAD", () => {
    initRepo();
    const sha = git(root, "rev-parse", "HEAD");
    git(root, "checkout", "-q", sha);

    const facts = gitFacts(root);

    expect(facts).toMatchObject({ inRepo: true, commitSha: null, branch: null });
  });

  describe("the diff-unit operations (12)", () => {
    /** A repo with a main branch and a feature branch that changed things. */
    function initDiffRepo(): { baseSha: string; headSha: string } {
      initRepo();
      writeFileSync(join(root, "keep.md"), "# Keep\n");
      writeFileSync(join(root, "gone.md"), "# Gone\n");
      git(root, "add", "-A");
      git(root, "commit", "-qm", "base");
      const baseSha = git(root, "rev-parse", "HEAD");

      git(root, "checkout", "-qb", "feature");
      git(root, "config", "user.name", "Feature Author");
      writeFileSync(join(root, "keep.md"), "# Keep — edited\n");
      writeFileSync(join(root, "new.md"), "# New\n");
      git(root, "rm", "-q", "gone.md");
      git(root, "add", "-A");
      git(root, "commit", "-qm", "feature work");

      return { baseSha, headSha: git(root, "rev-parse", "HEAD") };
    }

    it("detects the default branch from local heads when origin is absent", () => {
      initRepo();

      expect(defaultBranchRef(root)).toBe("main");
    });

    it("answers null outside a repo — the caller asks for an explicit base", () => {
      expect(defaultBranchRef(root)).toBeNull();
      expect(mergeBase(root, "main")).toBeNull();
      expect(resolveSha(root, "HEAD")).toBeNull();
    });

    it("finds the merge-base of a feature branch and resolves shas", () => {
      const { baseSha, headSha } = initDiffRepo();

      expect(mergeBase(root, "main")).toBe(baseSha);
      expect(resolveSha(root, "HEAD")).toBe(headSha);
      expect(resolveSha(root, "no-such-ref")).toBeNull();
    });

    it("names what a range changed, statuses included", () => {
      const { baseSha } = initDiffRepo();

      const changed = changedFilesOfRange(root, baseSha);

      expect(changed).toContainEqual({ path: "keep.md", status: "modified" });
      expect(changed).toContainEqual({ path: "new.md", status: "added" });
      expect(changed).toContainEqual({ path: "gone.md", status: "deleted" });
    });

    it("shows a file at a ref byte-exact — the trailing newline joins the content hash", () => {
      const { baseSha } = initDiffRepo();

      expect(showFileAt(root, baseSha, "keep.md")).toBe("# Keep\n");
      expect(showFileAt(root, "HEAD", "keep.md")).toBe("# Keep — edited\n");
      expect(showFileAt(root, baseSha, "new.md")).toBeNull();
    });

    it("credits the most recent author touching a file in the range", () => {
      const { baseSha, headSha } = initDiffRepo();

      expect(lastAuthorOfRange(root, baseSha, headSha, "keep.md")).toBe("Feature Author");
      expect(lastAuthorOfRange(root, baseSha, headSha, "untouched.md")).toBeNull();
    });
  });

  describe("interventionsFor", () => {
    it("finds commits whose trailer names the axiom, exactly (08-n)", () => {
      initRepo();
      git(
        root,
        "commit",
        "-qm",
        "harness: carry the error-message standard\n\nPraxis-Intervention: AX-b951db, AX-a108ea",
        "--allow-empty",
      );
      git(root, "commit", "-qm", "unrelated", "--allow-empty");

      const hits = interventionsFor(root, "AX-b951db");
      const near = interventionsFor(root, "AX-b951");

      expect(hits).toHaveLength(1);
      expect(hits[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(interventionsFor(root, "AX-a108ea")).toHaveLength(1);
      expect(near).toHaveLength(0);
    });

    it("is empty outside a repository", () => {
      expect(interventionsFor(root, "AX-b951db")).toEqual([]);
    });
  });
});
