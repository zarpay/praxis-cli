# The Evidence Loop

Most review tooling is amnesiac: it tells you what's wrong, you fix it, and the knowledge evaporates. Praxis is built around the opposite bet — **every review is evidence**, and evidence, kept honestly, compounds into a taxonomy of named standards and numbers you can actually trust.

This page follows one finding through the whole loop, using Scoop Society's service conventions.

## 1. A critique is born

A reviewer reads `redeem-coupon.ts` against `src/services/README.md` and fails it:

> Error message 'bad input' tells the consumer nothing about what was wrong or what would be accepted.

Two things happen. The verdict lands in the **cache** (`.praxis/cache/validation/`), keyed by a content hash of everything the reviewer saw — so the finding never has to be paid for twice. And a **critique record** lands in the **ledger** (`.praxis/ledger/runs/`), carrying full provenance: the run id, the exact content hashes of target and spec, and the reviewer's name, model, and behavioral hash. The run record it points to holds the rest — the commit, the branch, the costs and counts.

The cache answers *"is this compliant now"* and overwrites. The ledger answers *"what has ever happened"* and never does — run files are written once and never touched again, and both are committed to git.

## 2. Critiques recur, and triage sorts them

A week of runs produces the same complaint about five different services. Those critiques sit **untriaged** — raw reviewer prose, unassigned to any standard — until you run:

```bash
praxis axioms triage
```

The **curator** (a dedicated model configured beside your reviewers — worth a frontier model, since it does the taxonomy's thinking) classifies each untriaged critique against **all** active axioms — an axiom abstracts a principle, never a child of one spec, so a critique from any spec can land in any axiom. A squarely-an-instance match becomes an assignment record; everything else is recorded **unmatched** and queued for curation. Early on, with no axioms ratified yet, that's every critique — triage is how raw evidence reaches the curation queue.

## 3. Curate names the pattern

```bash
praxis axioms curate
```

The curator clusters the unmatched residue and suggests, cluster by cluster: fold these into an existing axiom, propose a new one, or admit they're unassignable. You decide — `[a]ccept / [d]ismiss / [s]kip`. Nothing the curator suggests takes effect without a human accepting it.

An accepted draft must first pass the **authoring gate**: anything a regex or linter could decide is refused. *If you can write the check, write the check; if you can only describe the standard, write the axiom.*

## 4. Ratification names the standard

The accepted proposal lands in `.praxis/axioms/proposed/` with a random-minted, permanent id. It affects nothing until:

```bash
praxis axioms ratify AX-b951db
```

Ratification is spec traceability: the curator quotes the spec text the principle derives from, and you make the call. Three outcomes — traceable (ratify), real-but-untraceable (the spec is incomplete; extend it and rerun), or not intended (reject; the rejection is recorded and feeds the reviewer-noise signal).

Ratified, the axiom is a markdown file in `.praxis/axioms/`:

```markdown
---
id: AX-b951db
version: 1
status: active
severity: error
derived_from: src/services/README.md#behavior
introduced: 2026-09-02
---

Error messages name what was wrong and what would be accepted instead.

## Violating example
`throw new Error("bad input")`

## Compliant example
`err("rating must be a whole number from 1 to 5")`
```

## 5. The label pass closes the loop

The reviewer never sees the axioms — it reads only the spec, and every critique still arrives raw; run and verdict output keep showing the reviewer's own words. But the next `praxis axioms triage` labels every recurring instance under `AX-b951db`, and the assignment is written to the ledger with its provenance (`matcher`). A matcher assignment is settled — it never re-enters a queue — and when two axioms later turn out to be one principle, `praxis axioms merge` re-labels the evidence in one move. From then on reports speak in the axiom's ratified words:

```
praxis eval report --axiom AX-b951db
```

```
Eval report

[WARN] Calibration: uncalibrated — numbers are directional, not interpretable

AX-b951db [flash] Error messages name what was wrong and what would be
accepted instead.
  current stock: 3/41 (7.3%) (as of 2026-09-05)
  critiques by population: pre-spec 2 · post-spec 1 · unknown 0
```

Whatever triage can't confidently label lands in the curation queue for the next human curate session — today's raw critique is tomorrow's axiom. And because axioms never enter the review, ratifying one costs nothing: no cache invalidation, no re-review — the reviewer's question changes only when the spec does.

For a developer or an agent, the label is a link, not a lecture: `praxis axioms show AX-b951db` is the drill-down with both examples, and the standard reads identically every run, on every machine.

## 6. Now — and only now — you can count

A raw critique can't be charted: its wording varies by run and by reviewer. An axiom can. `praxis eval report` computes over the ledger (never calling a reviewer):

- **Rates with denominators, always** — `3/41 (7.3%)` violations per applicable opportunity; any cell under the small-n floor renders *insufficient data*, never a number.
- **One reviewer, one series** — reviewers are separate instruments; their numbers are never pooled.
- **Populations** — every count is qualified pre-spec / post-spec against the axiom's `introduced` date, so old debt is never dressed up as new failure. `praxis debt report` charts that pre-spec backlog honestly: baseline stock, paydown, who paid it down, where it concentrates.
- **Epochs** — a reviewer's behavioral identity (config + prompt surface) is hashed onto every run. Change the model and you've changed the instrument: praxis announces the boundary, the next full run opens a new baseline, and no trend line crosses it.
- **The calibration banner** — every report says its numbers are directional, not interpretable: the reviewers are unvalidated instruments, and the reports refuse to pretend otherwise. Honesty is a feature.

## The division of labor

| Actor        | Does                                                              | Never does                          |
| ------------ | ----------------------------------------------------------------- | ----------------------------------- |
| **Reviewer** | Reads targets against specs; every critique arrives raw           | Sees an axiom, or checks anything a linter could |
| **Curator**  | Labels critiques at triage; clusters and drafts at curate; assesses traceability at ratify | Decides — every proposal is human-accepted, every ratification a human call |
| **You**      | Accept, dismiss, ratify, deprecate; own the specs                 | Manage cache or ledger files by hand |
| **The ledger** | Remembers everything, append-only, in git                       | Gets edited                         |

## See also

- [praxis axioms](/commands/axioms) — the lifecycle commands
- [praxis eval](/commands/eval) — runs, the ledger, and reports
- [praxis debt](/commands/debt) — the pre-spec backlog, honestly named
- [Writing Specs](/validation/writing-specs) — the judgment boundary
