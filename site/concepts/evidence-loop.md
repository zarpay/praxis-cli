# The Evidence Loop

Most review tooling is amnesiac: it tells you what's wrong, you fix it, and the knowledge evaporates. Praxis is built around the opposite bet — **every review is evidence**, and evidence, kept honestly, compounds into a taxonomy of named standards and numbers you can actually trust.

This page follows one finding through the whole loop, using Scoop Society's service conventions.

## 1. A critique is born

A reviewer reads `redeem-coupon.ts` against `src/services/README.md` and fails it:

> Error message 'bad input' tells the consumer nothing about what was wrong or what would be accepted.

Two things happen. The verdict lands in the **cache** (`.praxis/cache/validation/`), keyed by a content hash of everything the reviewer saw — so the finding never has to be paid for twice. And a **critique record** lands in the **ledger** (`.praxis/ledger/runs/`), carrying full provenance: the run id, the commit and branch, the exact content hashes of target and spec, the reviewer's name, model, and behavioral hash.

The cache answers *"is this compliant now"* and overwrites. The ledger answers *"what has ever happened"* and never does — run files are written once and never touched again, and both are committed to git.

## 2. Critiques recur, and triage names the pattern

A week of runs produces the same complaint about five different services. Those critiques sit on the **open channel** — raw reviewer prose, unassigned to any standard — until you run:

```bash
praxis axioms triage
```

The **curator** (a dedicated model configured beside your reviewers — worth a frontier model, since it does the taxonomy's thinking) clusters the pending critiques per spec and suggests, cluster by cluster: fold these into an existing axiom, propose a new one, or admit they're unassignable. You decide — `[a]ccept / [d]ismiss / [s]kip`. Nothing the curator suggests takes effect without a human accepting it.

An accepted draft must first pass the **authoring gate**: anything a regex or linter could decide is refused. *If you can write the check, write the check; if you can only describe the standard, write the axiom.*

## 3. Ratification grounds the standard

The accepted proposal lands in `.praxis/axioms/proposed/` with a random-minted, permanent id. It affects nothing until:

```bash
praxis axioms ratify AX-b951db
```

Ratification is spec traceability: the curator quotes the spec text that grounds the proposal, and you make the call. Three outcomes — traceable (ratify), real-but-untraceable (the spec is incomplete; extend it and rerun), or not intended (reject; the rejection is recorded and feeds the reviewer-noise signal).

Ratified, the axiom is a markdown file in `.praxis/axioms/`:

```markdown
---
id: AX-b951db
version: 1
status: active
severity: error
grounded_in: src/services/README.md#behavior
introduced: 2026-09-02
---

Error messages name what was wrong and what would be accepted instead.

## Violating example
`throw new Error("bad input")`

## Compliant example
`err("rating must be a whole number from 1 to 5")`
```

## 4. The checklist closes the loop

Active axioms grounded in a spec become that spec's **checklist**, rendered into every reviewer's prompt. From now on the same violation returns **matched** — cited by id, in the axiom's ratified words, deduplicated across reviewers into one finding with its witnesses counted:

```
[FAIL] src/services/redeem-coupon.ts
  - [AX-b951db] Error messages name what was wrong and what would be
    accepted instead. (2/2 reviewers)
```

Everything the checklist doesn't cover still arrives on the open channel — today's raw critique is tomorrow's axiom. The checklist also joins the verdict cache key, so ratifying an axiom automatically re-reviews everything its spec governs.

For a developer or an agent, a matched finding is a link, not a lecture: `praxis axioms show AX-b951db` is the drill-down with both examples, and the finding reads identically every run, on every machine.

## 5. Now — and only now — you can count

A raw critique can't be charted: its wording varies by run and by reviewer. An axiom can. `praxis eval report` computes over the ledger (never calling a reviewer):

- **Rates with denominators, always** — `3/41 (7.3%)` violations per applicable opportunity; any cell under the small-n floor renders *insufficient data*, never a number.
- **One reviewer, one series** — reviewers are separate instruments; their numbers are never pooled.
- **Populations** — every count is qualified pre-spec / post-spec against the axiom's `introduced` date, so old debt is never dressed up as new failure. `praxis debt report` charts that pre-spec backlog honestly: baseline stock, paydown, who paid it down, where it concentrates.
- **Violation flow** — `praxis eval run --diff` reviews both sides of what a branch changed and labels every matched finding by mechanical set-difference: **introduced**, **resolved** (credited to the git author who fixed it), or **inherited** (pre-existing debt, never blamed on the PR). The post-spec introduction rate this produces is the sharpest available signal of how well your agents and harness are doing — and it needs no authorship data at all.
- **Epochs** — a reviewer's behavioral identity (config + prompt surface) is hashed onto every run. Change the model and you've changed the instrument: praxis announces the boundary, the next full run opens a new baseline, and no trend line crosses it.
- **The calibration banner** — until reviewer calibration lands, every report says its numbers are directional, not interpretable. Honesty is a feature.

## The division of labor

| Actor        | Does                                                              | Never does                          |
| ------------ | ----------------------------------------------------------------- | ----------------------------------- |
| **Reviewer** | Reads targets against specs; critiques on two channels            | Checks anything a linter could      |
| **Curator**  | Clusters critiques, drafts proposals, assesses traceability       | Decides — every suggestion is human-ratified |
| **You**      | Accept, dismiss, ratify, deprecate; own the specs                 | Manage cache or ledger files by hand |
| **The ledger** | Remembers everything, append-only, in git                       | Gets edited                         |

## See also

- [praxis axioms](/commands/axioms) — the lifecycle commands
- [praxis eval](/commands/eval) — runs, the ledger, and reports
- [praxis debt](/commands/debt) — the pre-spec backlog, honestly named
- [Writing Specs](/validation/writing-specs) — the judgment boundary
