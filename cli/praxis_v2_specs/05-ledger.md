# 05 — The Ledger

**Status:** Early draft — capturing conversation output
**Depends on:** [vocabulary.md](./vocabulary.md), [01](./01-populations-and-eval-unit.md), [02](./02-baselines-and-debt-paydown.md)

## Why the cache cannot be the ledger

The existing cache (`.praxis/cache/validation/`) is a cost optimization: content-hash keyed, answering "is this file compliant right now." It **overwrites on change** — history is destroyed by design — and discards the OpenRouter `usage` block, so no cost data exists at all. Both are correct behaviors _for a cache_.

Observed corollary: the cache also cannot distinguish live from dead specs. In zarpay/core, 23 of 49 cached validations came from a spec file that no longer exists (`docs/subject-matter-experts/events.sme.md`); they persist indefinitely and double-count most files. (`orphanedCacheFiles()` detects deleted documents, not deleted specs — worth fixing in v1 regardless of v2.)

**Rule: the cache stays as-is in role — a separate, append-only ledger sits beside it.** The cache answers "now"; the ledger answers "ever."

Two format changes to the cache _are_ required by v2:

1. **Context joins the entry key** (01, axiom scope): for `file+context` axioms the judgment input includes spec-declared context files, so a verdict keyed on `hash(document + spec)` survives context edits it shouldn't. Key becomes `hash(document + spec + resolved context)`, with the resolved context file list + hashes recorded in the entry.
2. **Reviewer identity joins the verdict key** (02, epoch detection): one cache file per target holds every verdict for it — all specs, all reviewers — keyed by `<spec_hash>:<reviewer_hash>`, where the reviewer hash covers the reviewer's behavioral settings (the whole config canonically hashed minus `name` and `apiKeyEnvVar`) plus the system prompt text (a Praxis release that rewrites the prompt changes the reviewer as much as a model swap). This fixes a latent v1 defect: the reviewer config was in no key at all, so changing the model left every old-reviewer verdict looking current — pre-break verdicts leaking across an epoch boundary. One-artifact-per-target was chosen over per-reviewer directories deliberately: the cache is committed, so a target's complete judgment state should be one file with one history, cross-reviewer comparison (06 agreement) becomes a single read, and it finishes the format's own logic — specs were already multiplexed inside the file, and reviewers are the same dimension shape. Rollback stays free (reverting the config re-hits the old keys). Invalidation summary: **spec edit → per-spec keys break; reviewer change → all of that reviewer's keys break (global for that reviewer)** — the cache's invalidation behavior is the epoch structure. Keys belonging to no configured reviewer are prunable (a rewrite, not an `rm -rf` — the accepted cost of the single artifact).

The cache also gains a second consumer: verdict diffing (01) uses the parent version's cached verdict as the before-side of a diff evaluation, which is what makes diff-unit evaluation cost ~one reviewer call instead of two.

Cohort-scoped axioms (01) key their verdicts on a **cohort hash**: the sorted member list plus each member's content hash. Membership changes (file added, deleted, renamed) change the hash and are reviewable events in their own right — the ledger records the member manifest alongside the verdict so that "what set was reviewed" is reconstructable (provenance), and so cohort-level verdict diffing can distinguish a content change from a membership change.

## Shape

Append-only JSONL under `.praxis/ledger/`, partitioned by run, committed to git (consistent with the cache already being committed; diffs are meaningful, history is free).

**Run record** — one per validation invocation:

```
run_id, timestamp, commit_sha, branch, trigger (manual | ci | watch)
scope (corpus | diff | files), files_evaluated
reviewer_name, reviewer_model, reviewer_hash, prompt_tokens, completion_tokens, cost_usd
cache_hits, cache_misses
pass / warn / fail / unverified counts, critique_count
calibration_status_at_run                    # 06 — stamps interpretability
baseline: boolean                            # epoch-opening validate all (02)
```

`calibration_status_at_run` (implemented 2026-09-05) is stamped from 06's
per-reviewer derivation at write time: `calibrated`, `stale`, or the
historical `uncalibrated` (absent). Calibration records themselves live in
their own partition, `.praxis/ledger/calibration/<id>.json` — one
write-once JSON record per `calibrate run` × reviewer (shape in 06;
partition decided 2026-09-04, a 10-d design event within `ledger/`).

`diff` (added 2026-09-04, optional, scope `"diff"` runs only): the measured range and its coverage — `base_ref`, `base_sha`, `head_sha`, `changed_files`, `covered`, `uncovered_count`, `uncovered_paths`, `resolved_count`. The head sha is the run's anchor even on a dirty tree, because both sides are read via `git show`, never disk (12). `spec_units` (added 2026-09-03, optional): evaluated units per governing spec, stamped at write time — the applicable-opportunity denominator 07's rates divide by. Absent on older records, whose per-run rates suppress honestly. `reviewer_hash` (added at implementation, 2026-09-02) is what makes the derived-epoch promise true: `reviewer_model` alone cannot see a temperature, prompt-surface, or options change. `unverified` counts units that could not be reviewed at all (03) — never violations.

Epochs (02) are **derived, not stored**: an epoch is a maximal run-sequence with stable (spec content hashes, reviewer config), computable from the provenance fields above. Reports segment by epoch; the ledger just records facts.

**Runs are per reviewer.** With multiple reviewers configured (06), one CLI invocation fans out into one run record per reviewer; every critique record already names its reviewer via `reviewer_model` plus its configured `reviewer_name`. Epoch derivation, baselines, and metrics then work per reviewer with no special cases — the multi-reviewer ledger is just more of the same records.

**Critique record** — one per issue (axioms attach to critiques, not files):

```
id, run_id, timestamp
file_path, spec_path
target_content_hash, spec_content_hash      # provenance: exact inputs
reviewer_name, reviewer_model, reviewer_hash       # provenance: exact reviewer
severity, text
mode (judgment | agentic), scope_filtered?   # scoping exclusions recorded, not reviewed (03)
axiom_id?, axiom_version?, assigned_by?      # 04; null until assigned
population (pre_spec | post_spec)            # 01; recomputable
authorship, authorship_evidence, agent_involved, pre_review   # 02
introduced | inherited | resolved            # 01, computed by verdict diffing, never reviewed
before_run_id?                               # the run supplying the before-side verdict
resolved_by?                                 # resolved events only: git author of the resolving
                                             #   commit — paydown credit is attributable (02)
```

**Flow fields, as written since M5 (2026-09-04):** `flow` is set on diff-run critiques only (working-tree and corpus runs keep null — feedback and stock, never flow). `before_run_id` is the writing run's own id when the before side was freshly reviewed and null on a cache hit — a cache entry carries no run identity; extending the cache format with a `run_id` per entry is flagged as a possible future addition. Resolved events land as critique-shaped records with `flow: "resolved"`, hashed over the before-side content, excluded from `critique_count` and every stock surface, counted by the run's `diff.resolved_count`.

Provenance fields are mandatory. Derived fields (population, authorship) record their evidence so they can be _recomputed_ when conventions or spec birthdates are revised — stored classifications are conveniences, not truth.

## Write paths

- `BatchValidator.validateDocument` emits critique records alongside its existing cache write; run record on completion. Existing `cacheStats` feeds hits/misses directly.
- `DocumentValidator.callOpenRouter` captures `data.usage` (currently discarded where `choices[0]` is destructured) and returns it upward.
- The ledger is judgment-only (03): static tooling's findings never enter it.
- Cache hits write **no** critique records (nothing new was reviewed) but are counted on the run record. **Exception (2026-09-04, M5): diff runs record critiques for hit-served sides too** — the before/after comparison is new evidence even when both verdicts came from cache, and the flow labels are what the run exists to record; without them a replay would erase the flow that latest-per-branch reporting reads (12). (An earlier open question — backfilling the first ledger-enabled run from cache hits — was dropped 2026-09-02: no install has pre-ledger history worth reconstructing, and the first real run populates the ledger anyway.)

**Triage partition (added at implementation, 2026-09-03):** the ledger gains a second partition, `.praxis/ledger/triage/<session_id>.jsonl` — append-only records of triage decisions (`assignment`, `dismissal`, `rejection`), one file per session, same merge-safety as runs. Assignments are the superseding-record mechanism this document's integrity rule promises: a critique record's null `axiom_id` is never mutated; the assignment that resolves it is a new record referencing it. Checklist-born critiques (04's matched channel) carry `axiom_id`/`axiom_version`/`assigned_by: "checklist"` inline at write time.

## Integrity

- Append-only: no record is ever mutated. Corrections are superseding records referencing the original.
- Concurrent runs must not clobber: one file per run (`.praxis/ledger/runs/<run_id>.jsonl`) makes appends conflict-free and git merges trivial.
- Outside a git repo (or detached HEAD): `commit_sha: null` is legal; population/authorship fields go `unknown`, not guessed.

## Open questions

1. Retention/compaction: JSONL in git is fine for years at zarpay scale (hundreds of critiques/month). At what volume does this need an index or a different store? Explicitly deferred — plain files first.
2. PII/content: critique text can quote code. Ledger is in-repo, so no new exposure — but redaction hooks may matter if briefs (08) leave the repo.
3. Does `praxis validate` grow a `--no-ledger` flag, or is the ledger unconditional once configured? Tentatively unconditional: an eval store with optional gaps is not an eval store.
