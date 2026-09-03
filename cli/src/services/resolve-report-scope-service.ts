import type { ResolveReportScopeInput, ScopedLedger } from "@/types.js";

import picomatch from "picomatch";

import { commitDateOf, commitExists } from "@/helpers/git-helper.js";
import { Ledger } from "@/models/ledger.js";

/**
 * Scopes the ledger for one report invocation (07's three levels).
 *
 * Filters compose: runs narrow by branch, commit set, and since-date;
 * critiques narrow to the scoped runs and then by the target glob.
 * A requested sha that no longer resolves in this clone is collected —
 * with the branch and date its recorded runs attest, when any exist —
 * so the report can render 12's missing-commit note instead of erroring:
 * squash workflows orphan branch shas by policy.
 */
export default function resolveReportScope({
  root,
  target,
  since,
  branch,
  commit,
  commits,
}: ResolveReportScopeInput): ScopedLedger {
  const ledger = new Ledger({ projectRoot: root });
  const allRuns = ledger.runs();

  const requestedShas = commit ? [commit, ...(commits ?? [])] : (commits ?? null);
  const sinceDate = resolveSince(root, since);

  const unresolvableShas = (requestedShas ?? [])
    .filter((sha) => !commitExists(root, sha))
    .map((sha) => {
      const attested = allRuns.find((run) => run.commit_sha === sha);

      return { sha, branch: attested?.branch ?? null, at: attested?.timestamp ?? null };
    });

  const runs = allRuns.filter((run) => {
    if (branch && run.branch !== branch) return false;

    if (requestedShas && (run.commit_sha === null || !requestedShas.includes(run.commit_sha))) {
      return false;
    }

    if (sinceDate && run.timestamp < sinceDate) return false;

    return true;
  });

  const runIds = new Set(runs.map((run) => run.run_id));
  const matchesTarget = target ? picomatch(target, { dot: true }) : null;

  const critiques = ledger
    .critiques()
    .filter((critique) => runIds.has(critique.run_id))
    .filter(
      (critique) =>
        matchesTarget === null ||
        matchesTarget(critique.file_path) ||
        critique.file_path === target,
    );

  return {
    scope: {
      target: target ?? null,
      since: sinceDate,
      branch: branch ?? null,
      commits: requestedShas,
      unresolvableShas,
    },
    runs,
    critiques,
  };
}

/**
 * `--since` accepts an ISO date, or any git ref whose commit date
 * becomes the floor. Null when neither reading answers.
 */
function resolveSince(root: string, since: string | undefined): string | null {
  if (!since) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(since)) return since;

  return commitDateOf(root, since);
}
