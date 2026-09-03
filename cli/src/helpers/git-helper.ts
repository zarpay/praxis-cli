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

/** One git query, or null when git itself cannot answer. */
function git(root: string, ...args: string[]): string | null {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });

  if (result.status !== 0 || result.error) return null;

  return result.stdout.trim();
}
