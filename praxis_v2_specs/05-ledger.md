# 05 — The Ledger

**Status:** Early draft — capturing conversation output
**Depends on:** [vocabulary.md](./vocabulary.md), [01](./01-populations-and-eval-unit.md), [02](./02-baselines-and-debt-paydown.md)

## Why the cache cannot be the ledger

The existing cache (`.praxis/cache/validation/`) is a cost optimization: content-hash keyed, answering "is this file compliant right now." It **overwrites on change** — history is destroyed by design — and discards the OpenRouter `usage` block, so no cost data exists at all. Both are correct behaviors *for a cache*.

Observed corollary: the cache also cannot distinguish live from dead specs. In zarpay/core, 23 of 49 cached validations came from a spec file that no longer exists (`docs/subject-matter-experts/events.sme.md`); they persist indefinitely and double-count most files. (`orphanedCacheFiles()` detects deleted documents, not deleted specs — worth fixing in v1 regardless of v2.)

**Rule: the cache stays as-is in role — a separate, append-only ledger sits beside it.** The cache answers "now"; the ledger answers "ever."

Two format changes to the cache *are* required by v2:

1. **Context joins the entry key** (01, axiom scope): for `file+context` axioms the judgment input includes spec-declared context files, so a verdict keyed on `hash(document + spec)` survives context edits it shouldn't. Key becomes `hash(document + spec + resolved context)`, with the resolved context file list + hashes recorded in the entry.
2. **The cache is namespaced by judge hash** (02, epoch detection): `.praxis/cache/validation/{judge_hash}/...`, where the judge hash covers the model, validation settings, and the judge system-prompt version (a Praxis release that rewrites the system prompt changes the judge as much as a model swap). This fixes a latent v1 defect: today the judge config is in no key at all, so changing the model leaves every old-judge verdict looking current — pre-break verdicts leaking across an epoch boundary. Namespacing also makes rollback free: reverting the config re-hits the previous namespace. Invalidation summary: **spec edit → entry-level break (per-axiom-grained); judge change → namespace-level break (global)** — the cache's invalidation behavior is the epoch structure. Dead namespaces are garbage-collectable (orphan detection extends to namespaces whose judge hash matches no configured judge).

The cache also gains a second consumer: verdict diffing (01) uses the parent version's cached verdict as the before-side of a diff evaluation, which is what makes diff-unit evaluation cost ~one judge call instead of two.

Cohort-scoped axioms (01) key their verdicts on a **cohort hash**: the sorted member list plus each member's content hash. Membership changes (file added, deleted, renamed) change the hash and are judgeable events in their own right — the ledger records the member manifest alongside the verdict so that "what set was judged" is reconstructable (provenance), and so cohort-level verdict diffing can distinguish a content change from a membership change.

## Shape

Append-only JSONL under `.praxis/ledger/`, partitioned by run, committed to git (consistent with the cache already being committed; diffs are meaningful, history is free).

**Run record** — one per validation invocation:

```
run_id, timestamp, commit_sha, branch, trigger (manual | ci | watch)
scope (corpus | diff | files), files_evaluated
judge_name, judge_model, prompt_tokens, completion_tokens, cost_usd
cache_hits, cache_misses
pass / warn / fail counts, critique_count
calibration_status_at_run                    # 06 — stamps interpretability
baseline: boolean                            # epoch-opening validate all (02)
```

Epochs (02) are **derived, not stored**: an epoch is a maximal run-sequence with stable (spec content hashes, judge config), computable from the provenance fields above. Reports segment by epoch; the ledger just records facts.

**Runs are per judge.** With multiple judges configured (06), one CLI invocation fans out into one run record per judge; every critique record already names its judge via `judge_model` plus its configured `judge_name`. Epoch derivation, baselines, and metrics then work per judge with no special cases — the multi-judge ledger is just more of the same records.

**Critique record** — one per issue (axioms attach to critiques, not files):

```
id, run_id, timestamp
file_path, spec_path
target_content_hash, spec_content_hash      # provenance: exact inputs
judge_name, judge_model                      # provenance: exact judge
severity, text
mode (judgment | agentic), scope_filtered?   # scoping exclusions recorded, not judged (03)
axiom_id?, axiom_version?, assigned_by?      # 04; null until assigned
population (pre_spec | post_spec)            # 01; recomputable
authorship, authorship_evidence, agent_involved, pre_review   # 02
introduced | inherited | resolved            # 01, computed by verdict diffing, never judged
before_run_id?                               # the run supplying the before-side verdict
resolved_by?                                 # resolved events only: git author of the resolving
                                             #   commit — paydown credit is attributable (02)
```

Provenance fields are mandatory. Derived fields (population, authorship) record their evidence so they can be *recomputed* when conventions or spec birthdates are revised — stored classifications are conveniences, not truth.

## Write paths

- `BatchValidator.validateDocument` emits critique records alongside its existing cache write; run record on completion. Existing `cacheStats` feeds hits/misses directly.
- `DocumentValidator.callOpenRouter` captures `data.usage` (currently discarded where `choices[0]` is destructured) and returns it upward.
- The ledger is judgment-only (03): static tooling's findings never enter it.
- Cache hits write **no** critique records (nothing new was judged) but are counted on the run record. Open question: on first ledger-enabled run, backfill from cache-hit results so the ledger starts populated? Tentatively yes, marked `backfilled: true`.

## Integrity

- Append-only: no record is ever mutated. Corrections are superseding records referencing the original.
- Concurrent runs must not clobber: one file per run (`.praxis/ledger/runs/<run_id>.jsonl`) makes appends conflict-free and git merges trivial.
- Outside a git repo (or detached HEAD): `commit_sha: null` is legal; population/authorship fields go `unknown`, not guessed.

## Open questions

1. Retention/compaction: JSONL in git is fine for years at zarpay scale (hundreds of critiques/month). At what volume does this need an index or a different store? Explicitly deferred — plain files first.
2. PII/content: critique text can quote code. Ledger is in-repo, so no new exposure — but redaction hooks may matter if briefs (08) leave the repo.
3. Does `praxis validate` grow a `--no-ledger` flag, or is the ledger unconditional once configured? Tentatively unconditional: an eval store with optional gaps is not an eval store.
