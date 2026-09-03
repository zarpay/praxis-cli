import type { GitFacts } from "@/types.js";

import { spawnSync } from "node:child_process";

/**
 * The git facts a run is anchored by (05, 12).
 *
 * A sha is recorded only when the working tree provably equals HEAD —
 * clean, on a branch, inside a repo (12: a run reviews disk state, and
 * an uncommitted tree has no commit to anchor to). The branch is
 * recorded whenever one exists: it names a location, not content.
 * Anything the repo cannot answer is null, never guessed (05).
 *
 * `.praxis/` is excluded from the dirty check: the run's own cache and
 * ledger writes are machine-owned bookkeeping, not reviewed content,
 * and must not cost the run its sha.
 */
export function gitFacts(root: string): GitFacts {
  const branchName = git(root, "rev-parse", "--abbrev-ref", "HEAD");

  if (branchName === null) return { inRepo: false, commitSha: null, branch: null };

  const branch = branchName === "HEAD" ? null : branchName;

  if (!branch) return { inRepo: true, commitSha: null, branch: null };

  const dirty = git(root, "status", "--porcelain", "--", ".", ":(exclude).praxis");

  if (dirty === null || dirty !== "") return { inRepo: true, commitSha: null, branch };

  return { inRepo: true, commitSha: git(root, "rev-parse", "HEAD"), branch };
}

/** Whether a commit is reachable in this clone (12: expiry is a lifecycle event). */
export function commitExists(root: string, sha: string): boolean {
  return git(root, "cat-file", "-e", `${sha}^{commit}`) !== null;
}

/**
 * The date (YYYY-MM-DD) of the first commit that touched a file — 01's
 * file-level population approximation. Null outside git, for untracked
 * files, and wherever git cannot answer: unknown, never guessed.
 */
export function fileFirstCommitDate(root: string, path: string): string | null {
  const dates = git(root, "log", "--follow", "--format=%as", "--", path);

  if (dates === null || dates === "") return null;

  const lines = dates.split("\n");

  return lines[lines.length - 1];
}

/**
 * Authors of the commits that touched a file between two anchored runs
 * — paydown credit (02: credit is attributable where blame is not).
 * Empty when git cannot answer or nothing touched the file.
 */
export function authorsOfRange(
  root: string,
  fromSha: string,
  toSha: string,
  path: string,
): string[] {
  const authors = git(root, "log", "--format=%an", `${fromSha}..${toSha}`, "--", path);

  if (authors === null || authors === "") return [];

  return [...new Set(authors.split("\n"))];
}

/**
 * The commit shas a branch range contains, newest first — how `--commits`
 * resolves from a base..head range (07's PR scope).
 */
export function commitsOfRange(root: string, base: string, head: string): string[] {
  const shas = git(root, "log", "--format=%H", `${base}..${head}`);

  if (shas === null || shas === "") return [];

  return shas.split("\n");
}

/** The commit date (ISO) of a ref, for `--since <ref>`; null when unanswerable. */
export function commitDateOf(root: string, ref: string): string | null {
  return git(root, "log", "-1", "--format=%cI", ref);
}

/** One git query, or null when git itself cannot answer. */
function git(root: string, ...args: string[]): string | null {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });

  if (result.status !== 0 || result.error) return null;

  return result.stdout.trim();
}
