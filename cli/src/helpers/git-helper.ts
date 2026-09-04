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

/**
 * The merge-base ref a diff run defaults to (12): the remote's HEAD
 * branch when the clone knows it, else a local `main`, else `master`.
 * Null when none resolves — the caller asks for an explicit base.
 */
export function defaultBranchRef(root: string): string | null {
  const remoteHead = git(root, "symbolic-ref", "refs/remotes/origin/HEAD");

  if (remoteHead !== null) {
    return remoteHead.replace("refs/remotes/", "");
  }

  for (const branch of ["main", "master"]) {
    if (git(root, "rev-parse", "--verify", "--quiet", `refs/heads/${branch}`) !== null) {
      return branch;
    }
  }

  return null;
}

/** The merge-base sha of a ref and HEAD; null when git cannot answer. */
export function mergeBase(root: string, baseRef: string): string | null {
  return git(root, "merge-base", baseRef, "HEAD");
}

/** A ref resolved to its commit sha; null when it names no commit. */
export function resolveSha(root: string, ref: string): string | null {
  return git(root, "rev-parse", "--verify", `${ref}^{commit}`);
}

/**
 * The files a range changed, project-relative, with what happened to
 * each. Renames arrive as a deleted plus an added entry — the same
 * accepted coarseness as (axiom, file) finding identity (12).
 */
export function changedFilesOfRange(
  root: string,
  baseSha: string,
): { path: string; status: "added" | "deleted" | "modified" }[] {
  // --relative: paths come back relative to the praxis root even when
  // it is a subdirectory of the repo, and changes outside it drop out.
  const output = git(root, "diff", "--name-status", "--relative", baseSha, "HEAD");

  if (output === null || output === "") return [];

  return output.split("\n").flatMap(changedFileEntries);
}

/**
 * The file content at a ref, exactly as committed — never trimmed,
 * because the trailing newline joins the content hash and a trimmed
 * before side would miss every cache hit. Null when the file does not
 * exist at that ref.
 */
export function showFileAt(root: string, ref: string, relPath: string): string | null {
  // `./` scopes the path to the working directory, so a praxis root
  // nested inside the repo addresses its own files.
  const result = spawnSync("git", ["show", `${ref}:./${relPath}`], {
    cwd: root,
    encoding: "utf8",
  });

  if (result.status !== 0 || result.error) return null;

  return result.stdout;
}

/**
 * The author of the most recent commit touching a file within a range —
 * who `resolved_by` credits (02: cleanup is deliberate, directed work).
 * Null when git cannot answer or nothing touched the file.
 */
export function lastAuthorOfRange(
  root: string,
  fromSha: string,
  toSha: string,
  path: string,
): string | null {
  const author = git(root, "log", "-1", "--format=%an", `${fromSha}..${toSha}`, "--", path);

  return author === "" ? null : author;
}

/** One `--name-status` line as changed-file entries; renames become two. */
function changedFileEntries(
  line: string,
): { path: string; status: "added" | "deleted" | "modified" }[] {
  const [code, ...paths] = line.split("\t");

  if (code.startsWith("R")) {
    return [
      { path: paths[0], status: "deleted" },
      { path: paths[1], status: "added" },
    ];
  }

  if (code === "A") return [{ path: paths[0], status: "added" }];

  if (code === "D") return [{ path: paths[0], status: "deleted" }];

  return [{ path: paths[0], status: "modified" }];
}

/** One git query, or null when git itself cannot answer. */
/**
 * Commits whose `Praxis-Intervention:` trailer names the axiom (08-n):
 * ratified harness PRs record their targets, and reports annotate those
 * boundaries. Read-only, newest first; empty outside a repo.
 */
export function interventionsFor(root: string, axiomId: string): { sha: string; date: string }[] {
  const raw = git(
    root,
    "log",
    "--grep",
    "Praxis-Intervention:",
    "--format=%H|%cs|%(trailers:key=Praxis-Intervention,valueonly,separator=;)",
  );

  if (raw === null || raw === "") return [];

  return raw
    .split("\n")
    .map((line) => line.split("|"))
    .filter((parts) => parts.length === 3 && trailerNames(parts[2], axiomId))
    .map(([sha, date]) => ({ sha, date }));
}

/** Whether a trailer value list names the axiom id exactly. */
function trailerNames(values: string, axiomId: string): boolean {
  return values
    .split(/[;,]/)
    .map((value) => value.trim())
    .includes(axiomId);
}

function git(root: string, ...args: string[]): string | null {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });

  if (result.status !== 0 || result.error) return null;

  return result.stdout.trim();
}
