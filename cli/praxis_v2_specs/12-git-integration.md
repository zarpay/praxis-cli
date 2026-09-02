# 12 — Git Integration: How Diffs Become Eval Units

**Status: Draft — deliberately the simplest usable design**
**Depends on:** [01](./01-populations-and-eval-unit.md), [05](./05-ledger.md); complements [09](./09-cli-surface.md)

Every other document assumes diffs arrive from somewhere. This one says where, using nothing beyond four ordinary git operations — `merge-base`, `diff --name-only`, `show`, and `log` — so the strategy's efficacy can be predicted from working git knowledge alone. No hooks, no daemons, no history archaeology.

## Two reviewable states

1. **The working tree** — the fast loop (08). `praxis eval run <target>` reviews the file as it sits on disk, uncommitted. Provenance is the content hash of what was reviewed (always true by construction); there is no commit to anchor to, so the run record carries `commit_sha: null`. **Rule: working-tree runs are feedback, never measurement** — they write to the ledger (evidence is evidence) but are excluded from flow metrics and population assignment. If it isn't committed, it isn't measured.
2. **Committed state** — everything the eval measures. A measured run always describes a commit that exists at run time; its content hashes are what identify the work forever after.

## One diff unit: the branch, against its merge-base

The measured diff is **PR-shaped, not commit-shaped**:

```
praxis eval run --diff [<base>]     # base defaults to the default branch
```

Mechanics, in full:

1. `base = git merge-base <base-ref> HEAD`
2. Changed files = `git diff --name-only <base>...HEAD`, filtered to spec-covered targets. The uncovered remainder is recorded as the run's coverage statistic (01, open Q2 — resolved this way).
3. For each changed target: the **after** side is the file at HEAD; the **before** side is `git show <base>:<path>`. Both are reviewed as ordinary targets — the before side is usually a cache hit (its content hash was reviewed on an earlier run of the base branch), so the diff costs ~one reviewer call per changed target (01).
4. Verdict diffing (01) is set-difference on `(axiom_id, file)` between the two verdicts: after-only = *introduced*, before-only = *resolved*, both = *inherited*.

Why merge-base and not per-commit: commits are rewritten constantly (amend, rebase, fixup, squash) and individually carry no unit of intent; the branch-vs-base diff is what a review reads and what a PR merges. Re-running `--diff` on the same branch is **idempotent by construction** — each run is a fresh snapshot against the same base, not an increment — so repeated runs replace the picture rather than double-count; reports read the latest diff-run per branch.

## SHAs are provenance strings, not required-resolvable refs

Ledger records ride the branch they describe (they are files; a squash-merge carries them to the default branch like any other file). After the squash, the `commit_sha` they reference no longer resolves in the merged history — and that is fine, because **identity in this system is content hashes, not SHAs**. The SHA is recorded as opaque provenance (what state the run saw); every judgment is reproducible from `target_content_hash + spec_content_hash + reviewer_hash` without git's help. Nothing in the eval ever needs to check out an old SHA.

## Two triggers: manual and CI

- **Manual / agent-invoked** — the developer or coding agent runs `eval run` (fast loop) and `eval run --diff` (before pushing, or when the branch is ready). Ledger records land on the branch and travel with it.
- **CI** — `praxis eval ci` on the PR runs the same merge-base evaluation but **verifies without writing**: identical content hashes mean cache hits, so CI re-derives the verdicts, sets the exit code, and commits nothing. This sidesteps the bots-committing-to-PRs problem entirely: the branch's own ledger records, produced locally, are the durable evidence; CI is the enforcement gate.

`watch` (a daemon re-evaluating on file change) stays in the `trigger` enum (05) but is **deferred** — the fast loop's contract is "the agent runs the CLI after editing" (08, 09), which needs no daemon.

## Population assignment, mechanically

- **Axiom clock**: the axiom's `introduced` date (04) — already recorded, no git needed.
- **Spec birthdate** (first approximation): `git log --diff-filter=A --format=%aI -- <spec-path> | tail -1`.
- **Unit date**: the commit date of HEAD for measured runs. A diff is post-spec *relative to each axiom* iff its date is after that axiom's clock (01, per-axiom clocks).

## What this design accepts

- **`(axiom_id, file)` finding identity is coarse**: two violations of the same axiom in one file collapse into one finding, so a diff that adds a second violation while an old one stands reads as *inherited*. Accepted for the MVP; symbol-level anchoring sharpens it later without changing any record shape (location is already a field).
- **A branch evaluated mid-flight measures a moving target.** Accepted: snapshots are idempotent, and the merge-time run is the one reports treat as the branch's word.
- **Uncommitted work is invisible to metrics.** Accepted deliberately — it is the line that keeps provenance honest.

## Open questions

1. Should `eval ci` *warn* when a PR has no local diff-run in its ledger (evidence gap), or is cache-verified enforcement enough?
2. Merge queues / stacked branches: merge-base against what? Probably "the configured default branch" stays the answer; revisit when someone actually hits it.
