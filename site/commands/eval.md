# praxis eval

The eval loop: LLM reviewers read targets against their specs, verdicts are cached, and every run leaves evidence in the ledger.

## Prerequisites

Each reviewer runs through its configured provider — OpenRouter by default, or a custom provider module (see [Configuration — providers](/reference/config#providers)). Configure one or more reviewers in `.praxis/config.json` and set each reviewer's key variable:

```bash
export OPENROUTER_API_KEY=your-key-here
```

Each reviewer names its own variable via `apiKeyEnvVar` — see [Configuration — reviewers](/reference/config#reviewers). When multiple reviewers are configured, **every reviewer evaluates every target** and results are always reported per reviewer; `--reviewer <name>` runs just one.

## Subcommands

### `praxis eval run <targets...>`

Reviews one or more named targets against their specs — the **fast loop**, the command you (or your agent) run between edits.

```bash
praxis eval run src/services/redeem-coupon.ts
praxis eval run src/services/redeem-coupon.ts --spec custom-spec.md
praxis eval run src/services/redeem-coupon.ts --verbose
praxis eval run src/services/redeem-coupon.ts --no-cache
```

**Options:**

| Flag                | Description                                                     |
| ------------------- | --------------------------------------------------------------- |
| `--spec <path>`     | Override the spec file used for validation                      |
| `--reviewer <name>` | Run only the named reviewer (default: all configured reviewers) |
| `--verbose`         | Print the full AI reasoning after the result                    |
| `--no-cache`        | Skip the cache and always call the API                          |

**Exit code:** 0 unless a target has errors (warnings pass). A directory is refused with the glob hint (exit 2) — name files or a glob (`praxis eval run "src/services/*"`), or run the whole corpus with a bare `praxis eval run`.

---

### `praxis eval run` (no targets — full run)

Reviews every spec-governed target across all configured sources — the full run that opens epochs and measures the corpus.

```bash
praxis eval run
praxis eval run --type experts
praxis eval run --verbose
praxis eval run --no-cache
praxis eval run --fail-fast
```

**Options:**

| Flag                | Description                                                     |
| ------------------- | --------------------------------------------------------------- |
| `--type <type>`     | Review only one domain (the "By type:" label from a full run)   |
| `--reviewer <name>` | Run only the named reviewer (default: all configured reviewers) |
| `--verbose`         | Show full AI reasoning for each document                        |
| `--no-cache`        | Skip the cache for all documents                                |
| `--fail-fast`       | Stop at the first error instead of continuing                   |
| `--spec <path>`     | Review a single target against this spec file                   |
| `--json`            | Machine-readable outcome on stdout (see below)                  |

With multiple reviewers configured, progress lines carry a `[reviewer: <name>]` tag and the summary adds a `By reviewer:` breakdown — one row per reviewer, never pooled.

**Output:**

```
[1/4] src/services/apply-discount.ts
  ✓ PASS

[2/4] src/services/rank-parlors.ts
  ⚠ WARN
  · The happy path begins before the parlor id is validated.

[3/4] src/services/redeem-coupon.ts
  ✗ FAIL
  · Error message 'bad input' tells the consumer nothing about what was wrong or what would be accepted.

[4/4] src/services/send-newsletter.ts
  ✓ PASS

==================================================
Summary — corpus conformance (includes pre-spec debt)
==================================================

Coverage:
  ┌─────────────────────┬───────┬─────────┐
  │ COVERAGE            │ FILES │ RATE    │
  ├─────────────────────┼───────┼─────────┤
  │ Observed            │ 4/4   │ 100.00% │
  │ Passing             │ 2/4   │ 50.00%  │
  │ Not observed        │ 0/4   │ 0.00%   │
  │ Passing of observed │ 2/4   │ 50.00%  │
  └─────────────────────┴───────┴─────────┘

Verdicts:

  ● 2 pass   ● 1 warn   ● 1 fail

By type:
  ┌──────────────┬───────────────┐
  │ TYPE         │ COMPLIANT     │
  ├──────────────┼───────────────┤
  │ src/services │ 2/4 compliant │
  └──────────────┴───────────────┘

[CACHE] Hits: 0, Misses: 4

[SPEND] Time: 1m 12s, Cost: $0.0043
```

Each heading names the target by its path relative to the project root, with the directory in gray and the filename highlighted, so two files sharing a name are never confused.

Critiques print raw — the reviewer's own words against the spec. Labels come later: `praxis axioms triage` classifies the pending backlog under active axioms, and from then on reports cite the axiom's id and accepted words (drill-down at `praxis axioms show <id>`).

**Exit code:** 0 only when the run is clean — 1 when any target has errors **or is unverified** (warnings do not fail). An unverified target was never seen by a reviewer, so it cannot be allowed to pass silently.

---

### `praxis eval ci`

A full run with a structured summary, for pull request pipelines. The summary prints eval coverage beside the conformance tally — observed, passing, and passing of observed — so the gate states how much of the corpus it actually gates, how much of it currently clears, and how much of what it gates clears. Passing is the number to hold a bar against.

```bash
praxis eval ci
praxis eval ci --strict
```

**Options:**

| Flag            | Description                                                        |
| --------------- | ------------------------------------------------------------------ |
| `--strict`      | Fail on warnings too                                               |


**Exit code:** 0 = clean; 1 on any error or unverified target — and, under `--strict`, on warnings too.

---

### `--json`: the fast loop's delivery

`praxis eval run <target> --json` emits the outcome as stable JSON on stdout — the feedback a coding agent or a CI hook consumes directly. Critiques carry their raw text (labels are applied later, at triage, and appear in reports); corpus mode emits the run summary plus `coverage { sourceFiles, observed { files, rate, display }, passing { files, rate, display }, passingOfObserved { files, rate, display } }` — observed is the share of source files any spec governs; passing is the CI-grade score, files every reviewer's verdict passes; passingOfObserved is that count over the observed files instead of the corpus. `eval verdict` and bare `praxis` take `--json` too.

## `praxis eval verdict <path>`

Displays a target's cached verdict. Does not call any API.

```bash
praxis eval verdict src/services/redeem-coupon.ts
praxis eval verdict src/services/redeem-coupon.ts --verbose
```

Shows one of five states:

| Status            | Meaning                                                                    |
| ----------------- | -------------------------------------------------------------------------- |
| **PASS**          | Document is compliant                                                      |
| **WARN**          | Document has warnings but no hard errors                                   |
| **FAIL**          | Document has errors                                                        |
| **STALE**         | Target changed since last review (cached verdict may no longer apply)      |
| **NOT VALIDATED** | No cached result exists yet                                                |

Use `--verbose` to include the full AI reasoning from the cached result.

**Exit code:** 0 when the verdict report renders, whatever the verdict says — inspection never fails on a FAIL. It errors instead when the target does not exist or no configured reviewer has an opinion about it.

### `praxis eval prune`

Drops cached verdicts that no configured reviewer can hit again. Does not call any API.

```bash
praxis eval prune
```

Every cached verdict is keyed by its reviewer's behavioral hash, so changing a reviewer's model, prompts, or settings — or removing the reviewer — orphans its old entries: they sit in the committed cache files but can never be read. Pruning removes those entries, deletes cache files left empty, and clears out files in an unreadable or outdated format.

Safe to run any time: entries belonging to currently configured reviewers are never touched, and a second run finds nothing to do.

**Exit code:** Always 0.

---

### `praxis eval compact`

Folds the ledger's run files into one stamped archive. Does not call any API, and changes no record.

```bash
praxis eval compact
```

A busy project accumulates run files fast, and most of them are tiny: a run whose every unit came back a cache hit records one line and nothing else. In zarpay's own repo, 1,126 run files held 1.1 MB of records — 82% of them all-hit runs, 94% a single record — and cost 4.7 MB on disk, because a file below one disk block still costs a whole one. Every command that reads the ledger opened all 1,126.

Compaction rewrites that to a single `.praxis/ledger/runs/<id>-compacted.jsonl` and one open. The records are **moved, not rewritten**: the bytes appended to the archive are each source file's own, in the order they were written, so the record set is byte-identical and `eval report`, `eval critiques`, `debt report` and the orientation screen all produce exactly what they produced before.

This is a layout change, not a retention policy. Nothing is dropped, summarized, or aged out — the ledger still answers what has ever happened, in the same format, read the same way. A file holding no run record is left exactly where it is.

The archive is named for **when it was made, not what it holds**, which is what makes it safe on a team. Two people who compact on their own branches write two differently named files, so the merge has no conflict to resolve — and the history they both carry is not double-counted, because runs and critiques are identified by their ids and the readers take the first copy of each.

Safe to run any time; a second run finds nothing to do. Because it rewrites committed files, run it on a clean tree and commit the result on its own.

**Exit code:** Always 0.

---

## praxis eval critiques

The ledger's critiques as a browsable list — each with its id, its words, and where it stands: **untriaged** (triage's queue), **unmatched** (curate's queue), **labeled**, **dismissed**, or **advisory** — recorded by [`praxis feedback`](/commands/feedback) and in no queue at all, so it is never counted as work waiting. Pure read; never a reviewer call.

```bash
praxis eval critiques src/services --state unmatched
praxis eval critiques --axiom AX-b951db
praxis eval critiques --json
```

The ids are what [`praxis axioms reassign`](/commands/axioms#praxis-axioms-reassign-id) and `praxis eval review --dismiss` take.

## praxis eval review

The validity session — the one place a critique is judged **invalid**. Triage and curate decide which axiom a critique belongs to and take for granted that every critique is true; whether the reviewer actually said something grounded is a human's call, made here.

```bash
praxis eval review src/services
praxis eval review --dismiss 20260907T101932101Z-c0f5baa5:6 --reason "the spec permits this"
praxis eval review --dismiss <id> <id> <id> --reason "the spec permits this"
praxis eval review --reinstate 20260907T101932101Z-c0f5baa5:6 --reason "misread the spec"
```

`--dismiss` and `--reinstate` take **several ids under one reason** — the shape `praxis axioms curate` hands you when you mark a whole cluster for review. Each critique still gets its own record, so reports and reinstatement are unchanged; one unknown id refuses the whole batch rather than dismissing the ids before it.

Interactively, every **untriaged** or **unmatched** critique in scope comes up one at a time — a critique labeled under an axiom is valid by definition (a human or the matcher found it an instance of a standard), so it is never offered and `--dismiss` refuses it; `axioms reassign` is the tool when it belongs elsewhere. Each card shows where it was said, by which reviewer, the words, and where the label lifecycle has it, and you choose `[d]ismiss / [r]est / [n]ext / [q]uit` — `[r]est` dismisses the current critique and every one remaining in scope under a single reason. A dismissal takes a reason and is appended to the ledger. A dismissed critique is not evidence: it leaves every queue, is never labeled or curated, and `axioms reassign` refuses it, until `--reinstate` lifts the dismissal.

The dismissal count over all critiques is the **reviewer-trust signal**, printed at the end of the session and on `eval report`: many dismissals mean the specs disagree with the humans, or the reviewers are drifting. Because curate never dismisses, the number means exactly that.

## The ledger

Every `eval run` writes durable evidence to `.praxis/ledger/runs/<run_id>.jsonl` — one file per reviewer per invocation, committed to git like the rest of `.praxis/`. The first line is the **run record**: what ran, against which commit and branch, cache hits and misses, verdict counts, and the provider cost (tokens and dollars). Each following line is a **critique record** — one per issue found, carrying full provenance: the exact target and spec content hashes, and the reviewer's behavioral hash.

The cache answers "is this compliant now" and overwrites; the ledger answers "what has ever happened" and never does. Records are append-only — a record is written once and never touched again.

One file per run is what keeps two runs landing at once from clobbering each other; it is a write-time property, not a storage format. Once history is sealed, [`praxis eval compact`](#praxis-eval-compact) folds those files into one stamped archive without changing a single record.

Two things never write the ledger: `eval ci` (CI verifies without writing — the branch's own runs are the evidence) and cache hits (nothing new was reviewed; they are counted on the run record instead).

**Evidence grades**: a run made from a clean tree on a branch records its `commit_sha`, and that sha reconstructs everything — the target and the spec live in that commit. A fast-loop run on a dirty tree is _attested_ (content hashes prove what the reviewers saw) but not reconstructable, and praxis says so at run start. Praxis never creates commits — when you want archive-grade evidence on every run, run eval from a hook or CI, where clean trees are free.

A target that cannot be reviewed at all is reported **UNVERIFIED**: counted separately, never as a violation, and the run fails so it cannot pass unseen. Three causes, and the message names which:

- the file is **unreadable**, or the cohort is **too large** for the model's context window
- the model **answered without calling a tool**, or returned tool arguments that are not valid JSON (the error quotes the payload around the parse failure, and says whether `max_tokens` cut it off)
- the **provider or its upstream failed** — including a backend that returns HTTP 200 carrying an error instead of a completion, which the error reports verbatim: `response carried no choices — {"error":{"message":"Upstream idle timeout exceeded","code":504…`

The last one is transient and concentrated on long prompts — large cohorts are where it shows up. An unverified unit is **never cached**, so simply running again re-reviews exactly those units and leaves the rest on cache. If a model does it persistently, that is a signal about the model: switch reviewers, or split the cohort.

## praxis eval report

The read side of the ledger — never a reviewer call. Scopes compose: `eval report [path|glob]` for files (a bare directory reads as everything under it), `--commit <sha>` / `--commits <shas...>` for a commit or a PR's set, `--branch`, `--since <date|ref>`, and `--axiom <id>` for the single-category drill-down. Every invocation prints the same discipline:

- rates as `violations/opportunities (x.xx%)`, two decimals, with the denominator always shown; cells under the small-n floor (5) render **insufficient data**, never a number. Current stock anchors to the latest *evidenced* corpus run (one with cache misses) and prints its date — an all-hit run proves nothing new and never moves the anchor
- one reviewer, one series — never pooled; every count qualified by population (pre-spec / post-spec / unknown, derived from git birthdates against each axiom's clock)
- epoch boundaries as named furniture; nothing trends across one
- costs, the dismissed-as-invalid rate (the reviewer-trust signal), and the two queues
- a requested sha that no longer resolves renders the missing-commit note (squash workflows orphan branch shas by policy) — the run's attestation stays usable

`--json` emits the built payload verbatim — the stable machine contract.

## Raw critiques, labeled later

Every critique arrives raw — the reviewer sees only the spec, never the axioms (see [praxis axioms](/commands/axioms)): labels are applied afterwards by `axioms triage`, and reports then cite the axioms' stable ids and accepted words. The reviewer is told the judgment boundary: mechanical criteria (anything a linter could decide) are out of scope and must not be reported.

## Epoch boundaries

A reviewer's behavioral identity — its config plus the reviewer-facing prompt text this praxis version ships — is hashed onto every run record. When a run starts with a hash the ledger has never seen for that reviewer, praxis announces an **epoch boundary**: measurements on either side of it are not comparable, and no trend line crosses it. The warning names what changed (a model swap says so; anything else is config or prompt surface) and never blocks the run.

The right move after a boundary is a full `praxis eval run`: the first full run under a new hash is stamped `baseline: true` and opens the new epoch's measurement floor.

Team note: the hash is content-addressed, so teammates on different praxis versions only split hashes when a release actually changed the reviewer-facing prompts. If you see a boundary with no config diff, check CLI versions across the team — and once a hash is in the ledger, teammates running the older version won't re-trigger the warning.

## How a review works

1. The spec file (default: `README.md`) defines the standards — plus any scoping frontmatter (`paths`, `cohort`, `excludes`, `context`), which decides what is reviewed without being reviewed against.
2. Praxis sends the spec's **body**, the target, and any context files to each configured reviewer via its provider (OpenRouter by default). The frontmatter stays behind: it routes the review, it is not part of the standard.
3. The reviewer answers through a required tool call — pass, warn, or fail — with specific issues.
4. The verdict is written to the cache at `.praxis/cache/validation/`, keyed by spec and reviewer.

On subsequent runs, cached verdicts are used for any target whose review input (target, spec body, context files) has not changed — the hash covers exactly the material that reaches the prompt, so retargeting a spec re-reviews nothing. See [Caching](/validation/caching).

## See also

- [Writing Specs](/validation/writing-specs)
- [Caching](/validation/caching)
- [CI Integration](/validation/ci)
- [The Evidence Loop](/concepts/evidence-loop)
