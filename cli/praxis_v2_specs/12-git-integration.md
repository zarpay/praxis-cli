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
4. Verdict diffing (01) is set-difference on `(axiom_id, file)` between the two verdicts: after-only = _introduced_, before-only = _resolved_, both = _inherited_.

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
- **Unit date**: the commit date of HEAD for measured runs. A diff is post-spec _relative to each axiom_ iff its date is after that axiom's clock (01, per-axiom clocks).

## What this design accepts

- **`(axiom_id, file)` finding identity is coarse**: two violations of the same axiom in one file collapse into one finding, so a diff that adds a second violation while an old one stands reads as _inherited_. Accepted for the MVP; symbol-level anchoring sharpens it later without changing any record shape (location is already a field).
- **A branch evaluated mid-flight measures a moving target.** Accepted: snapshots are idempotent, and the merge-time run is the one reports treat as the branch's word.
- **Uncommitted work is invisible to metrics.** Accepted deliberately — it is the line that keeps provenance honest.

## Anchoring (decided 2026-09-03)

**Praxis never creates commits; anchoring is the workflow's job.** A run's `commit_sha` is recorded exactly when the reviewed tree provably equals a named commit on a branch — that non-null sha _means_ reconstruction-grade evidence (the whole measurement state, axioms included, lives in that tree). Auto-committing, refusing dirty trees, or synthetic off-branch snapshots were each considered and rejected: they respectively pollute the developer's history (10), kill the fast loop (08), or mint phantom states that neither sync nor deserve measurement. The fast loop's runs are feedback on transient states — attested by content hashes, not reproducible from git — and `praxis eval run` says so at run start (warn, never block) whenever it runs inside a repo whose tree is not clean-on-a-branch, so nobody discovers the evidence grade at forensics time. Teams that want every run archive-grade enforce it where commits live: hooks and CI.

**Unreachable shas (decided 2026-09-03).** A recorded `commit_sha` that no longer resolves is an expected lifecycle event, not corruption — squash-merge workflows orphan every feature-branch sha by policy. Any surface that resolves shas (07's `eval report --commit`, forensics views) renders the missing-commit note instead of erroring, canonically:

> Commit `<sha7>` (branch `<branch>`, `<run date>`) is not reachable in this clone. The record is sound — praxis read the sha from a provably clean tree when the run happened — but the commit has since left this clone's history. Most likely, in order: the branch was **squash-merged or rebased**, so the same work now lives under a different sha; the commit was **never pushed** from the machine that ran the eval; this clone is **shallow or unfetched** (`git fetch --all --unshallow` may recover it); or the branch was **deleted unmerged**. The evidence still stands either way: the critique's content hashes attest exactly what was reviewed. To relocate the reviewed code, match `target_content_hash` against the file's surviving history (`git log --all -- <file_path>`).

The operational guidance that follows: in squash/rebase workflows, branch-run anchors are **branch-lived** — durable exactly as long as the branch. The permanent anchor is the post-merge run on the target branch (a hook or scheduled `eval run` after merge; `eval ci` verifies but writes nothing), whose sha is the one history keeps. Reports may annotate a run whose sha went unreachable as _anchor expired_ — distinct from _never anchored_ (`commit_sha: null`), because the attestation and the branch/date facts remain fully usable for time-series and per-axiom rates; only byte reconstruction is lost.

## Implementation decisions (2026-09-04, M5)

- **Both sides come from `git show`, never disk.** The after side is read at the head sha, so a dirty tree cannot leak into a measured run and reruns are idempotent snapshots by construction. `commit_sha` keeps its clean-tree anchoring semantics; the run's own anchor is the recorded `diff.head_sha`, honest even on a dirty tree.
- **The before side reads the cache but never writes it.** The persistent cache holds one entry per (target, spec, reviewer) — the *current* state — so the two sides of a diff would thrash it. The before side runs against a read-only handle and the after side writes last, leaving the cache exactly where the next corpus run on this tree expects it. Cost structure: the first diff run after a base-branch review pays ~one call per changed file (the before side hits); a replay re-pays at most the before side.
- **`before_run_id`** is this run's id when the before side was freshly reviewed, null on a cache hit — a cache entry carries no run identity, and unknown is never guessed. (Flagged in 05: adding `run_id` to cache entries would make the cached case attributable later.)
- **Open-channel critiques get no flow.** `(axiom_id, file)` identity does not exist for a null axiom id, and set-differencing prose would label rephrasings as churn. After-side open critiques keep `flow: null` and go to triage; vanished open before-critiques emit nothing.
- **The gate is the diff's own contribution**: `eval run --diff` fails on introduced error-severity findings or any unverified target (a one-sided comparison is not a comparison); inherited debt and resolutions never fail a PR.
- **Coverage means "would a corpus run review it"** — by-file unit membership, honoring `paths:`, `excludes:`, and `ignore`. A deleted file falls back to its sibling spec (a `paths:`-targeted deletion stays invisible — accepted coarseness); files governed only by a `by_directory` cohort spec count as uncovered until cohort diff units land with the scope itself.
- **Resolved events are critique-shaped records** (`flow: "resolved"`) hashed over the *before* content — that is what the critique described — with `resolved_by` = the most recent git author touching the file in base..head. They are paydown facts: `critique_count` and every stock surface exclude them; `diff.resolved_count` counts them.


> **Gate variance under nondeterministic reviewers** (observed live
> 2026-09-05): `eval ci --diff` re-reviews any side the cache cannot
> serve, so with nondeterministic reviewers the gate can flip between
> invocations on identical trees — one run's fresh before-review yields
> an introduced error the next run's does not. This is the instrument's
> variance (06), not a defect in the gate: the mitigations are the
> committed diff-run evidence the warning above asks for (warm sides are
> served deterministically from cache) and calibration's noise floor.
> A team that wants a deterministic gate keeps the branch's diff run
> committed and the cache warm.

## Open questions

1. ~~Should `eval ci` _warn_ when a PR has no local diff-run in its ledger (evidence gap), or is cache-verified enforcement enough?~~ **Resolved 2026-09-04:** `eval ci --diff` warns — the gap is named, never failed on.
2. Merge queues / stacked branches: merge-base against what? Probably "the configured default branch" stays the answer; revisit when someone actually hits it.
