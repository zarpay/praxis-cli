# 04 — Axioms

**Status: Rewritten 2026-09-07 (owner) — review→label.** Supersedes the
two-channel model. Depends on: [vocabulary.md](./vocabulary.md),
[03-judgment-boundary.md](./03-judgment-boundary.md).

## Why axioms exist

Critiques are prose; prose cannot be counted. An axiom is the enumerable
unit: a named, versioned standard that recurring critiques aggregate
under, so a report can say "this standard, violated this often, in these
places" instead of paraphrasing reviewer prose. The non-negotiable
property is **identity stability**: the same standard keeps the same id
forever, or every rate computed under it is fiction.

## The separation principle

**The reviewer sees only the spec.** Axioms are a taxonomy over
evidence — they are never review input. Four grounds (owner, 2026-09-06,
during the servus adoption):

1. **Traceability makes injection redundant.** Every active axiom is
   derived from critiques whose standard the spec already states, so it
   carries no standard the spec does not. A reviewer that needs the axiom restated
   in its prompt is evidence the spec does not carry the standard — a
   defect injection would hide.
2. **Symmetry.** Axioms never enter generation (the withdrawn 08's one
   surviving law), and the eval's honesty rests on the judge seeing
   exactly the direction the worker was given. A checklist in the review
   prompt broke that symmetry from the judge's side.
3. **Instrument contamination, measured.** Adding one checklist item
   moved four unrelated axioms from variance 0 to 0.89 in live
   calibration (servus, 2026-09-06) — the taxonomy was physically
   distorting the measurement device.
4. **One source of truth.** Ratifying an axiom changed review outcomes
   without changing the spec — editing the spec through a side door.

Consequences: the content hash covers target + spec + assists only, so
**ratification never invalidates a verdict and never re-reviews
anything**; the reviewer's question changes only when the spec does.

## Format

Markdown + frontmatter in `.praxis/axioms/`, versioned in git.

```yaml
---
id: AX-3f9c2d # stable; never reused, never renumbered; random-minted (see note)
version: 2
status: proposed | active | deprecated
mode: judgment # see 03
severity: error | warning
derived_from: backend/app/events/README.md#payload-schema # provenance, established at ratification — see below
introduced: 2026-08-29
---
Statement of what the axiom asserts.
A violating example. A compliant example.
```

**`derived_from` is provenance, never identity** (owner, 2026-09-07,
renamed from `grounded_in`): an axiom does not represent an exact spec
passage — it is a principle derived from many critiques that were
themselves consequences of the spec(s); the axiom layer is the
bucketing/grouping layer over that evidence. The key records where the
ratifier traced the principle at ratification time, and it may go stale
as a spec is edited and its sections move — the axiom stays valid; the
pointer is metadata. Never treat it as a live reference.

The former `scope:`/`context:` keys are retired (2026-09-07): the spec
alone declares review scope and context (03) — an axiom that never
reaches the reviewer has nothing to scope. `supersedes` is retired too
(owner, 2026-09-07: not helpful at this point) — replacement history
lives in git and the ledger. Historical files carrying retired keys
parse fine; the keys are ignored, and a historical `grounded_in` reads
as `derived_from`.

**Implementation notes:** ids are `AX-` + 6 random hex, never
sequential — two contributors minting on separate branches must not be
able to mint one id for two standards. Chronology lives in `introduced`,
not the id. The organizing/labeling/gating/tracing model is the config's
`curator` role — required for those verbs, never defaulted to a
reviewer.

> **Axioms are atomic** (owner, 2026-09-06): a statement never
> references another axiom by id or name. Coupling rules means renaming
> or deprecating one silently corrupts its neighbor, and anyone applying
> one rule must never need to resolve another. A scope boundary is
> stated in the rule's own terms ("this rule judges presence only; the
> quality of an example that exists is outside its scope") or defers to
> the spec — never to a sibling axiom. Applies to the curator's drafts
> and the authoring gate alike.

## Review → Label

Every critique is **born raw**: the reviewer's tool schema has no axiom
field, and the run writes critique records with `axiom_id: null`,
`assigned_by: null`. From there a critique is in exactly one of three
states (owner, 2026-09-07), decided in one place
(`derive-triage-state`):

1. **Untriaged** — no triage record covers it. Triage's queue: "let's
   categorize these critiques we've never seen before."
2. **Unidentified** — the matcher considered it against the spec's
   current active axioms and found no squarely-matching one, recorded
   as an **unmatched record** pinning the axiom set considered
   (`considered: ["AX-x@1", …]`). Curate's queue, and ONLY curate's:
   the question "does this need a NEW axiom" is well-posed only after
   triage has said no existing one fits. When the spec's active set
   later changes, the pinned set no longer matches and the critique
   re-queues for triage automatically — "never seen before" means
   never seen against the current taxonomy.
3. **Identified** — an assignment record labels it (or a dismissal
   settles it); it appears in no queue.

Labels are applied as append-only records, by two verbs:

1. **`praxis axioms triage` — the labeling pass** (async,
   non-interactive). The curator classifies each untriaged critique
   against **all active axioms** — an axiom is an abstraction of
   principle, never a child of one spec: multiple specs can state in
   prose what one axiom captures discretely, so a critique from any
   spec can land in any axiom (owner, 2026-09-07); `derived_from` is
   provenance of birth, never a labeling scope —
   temperature 0, **one call per critique** (owner, 2026-09-07): a
   batched list lets earlier answers anchor later ones and dilutes
   attention, so ordering becomes a source of mislabeling; a
   single-critique prompt has no order to bias it, and a failed call
   costs one critique, not a batch. Calls run a few at a time —
   order-independence is what makes the parallelism safe.
   Squarely-an-instance matches append assignment records with
   `assigned_by: {decision: "matcher", suggested_by: <model>}`;
   everything else stays pending. The hallucination guard lives here:
   an id not among the spec's active axioms never becomes an
   assignment (nor an unmatched verdict — a hallucinating call is a
   failed call, and its critique stays untriaged for retry). A project
   with no active axioms needs no calls: every critique is trivially
   unmatched against the empty set and moves straight to curate's
   queue. `--dry-run` proposes without writing; no curator configured →
   warn and defer, never fake. Each verdict streams to the terminal as
   it lands.
2. **`praxis axioms curate` — the human session** (the verb formerly
   named triage). Interactive work on the **unidentified** critiques —
   never the merely untriaged, which it names and defers to triage.
   Cluster recurring critiques into proposed axioms, dismiss noise with
   reasons, assign stragglers by hand. Every decision is a ledger record. Clustering
   cannot happen per-critique — a category only emerges from a grouping
   large enough to show it — but the grouping is bounded (owner,
   2026-09-07): identical critique texts dedup into one member (its
   duplicates counted, and every duplicate receives the member's
   decision), and the curator sees at most one **cohort** (~30 distinct
   critiques) per call, with the session's accepted proposals carried
   into later cohorts as fold targets so categories consolidate instead
   of re-emerging per cohort.

**Labels are assignment records, and readers join them.** A critique's
effective axiom identity is decided in exactly one place
(`join-critique-labels`): the newest record per critique wins — an
assignment labels, a dismissal unlabels, a human record supersedes a
matcher record by arriving later. Historical checklist-born critiques
(pre-2026-09-07 records carrying inline `axiom_id` and
`assigned_by: "checklist"`) keep counting unless superseded — committed
evidence never re-shapes. This join also closes the old hole where human
assignments never reached the metrics.

The machine-assignment question (the old L50 argument that assignment
error corrupts rates like reviewer error): met with provenance and
override rather than prohibition — every label says whether a machine or
a human made it, a human can re-decide any of it at curate, and the
matcher is instructed for precision over coverage (an unlabeled critique
costs one curate moment; a wrong label corrupts a rate).

## Lifecycle rules

- The **LLM proposes; a human ratifies.** Nothing enters the taxonomy
  without ratification against the spec's own text (traceability), and
  the authoring gate (03) checks each proposal is genuinely
  judgment-shaped — splitting mixed proposals when it is not.
- **Statements are immutable per version**; wording changes bump
  `version`. A version bump changes nothing about reviews (see the
  separation principle) — the next triage simply labels against the new
  wording.
- **Deprecation keeps history**: `praxis axioms deprecate <id>
  --reason` retires an active axiom — the id and its records stay
  readable forever, a deprecation record lands in the triage ledger,
  and (the active set having changed) every unidentified critique
  re-queues for triage. A replacement is simply a new id; lineage lives
  in git and the ledger.
- **Over-splitting is collapsed, never endured** (owner, 2026-09-07).
  Prevention: the authoring gate checks every draft against the
  taxonomy on record (active + proposed) and answers `duplicate_of` —
  a candidate with the SAME REMEDIATION as an existing axiom folds its
  cluster there instead of landing as a twin; curate also offers
  standing proposals as fold targets, and `axioms audit` flags
  same-remediation pairs among active axioms as merge candidates.
  Cure: `praxis axioms merge <ids...> --into <id>` — every critique
  whose effective label is a merged-away axiom gets a re-assignment
  record to the survivor (decision "merge"; the prior label stays in
  the ledger beneath it), the losers deprecate with the merge named,
  and the survivor's `introduced` moves to the earliest among the
  merged so folded evidence is not misread as pre-spec debt. Nothing
  is rewritten; reports recompute from the join instantly.
- **Per-axiom population clocks** start at `introduced` (01): critiques
  on code born before the axiom are pre-spec debt, never blamed on the
  present.
- **Reviewer independence is structural**: reviewers never see axioms,
  so a reviewer change cannot move the taxonomy, and all reviewers'
  critiques label into the same axiom set.

## Residual

The residual is the critiques curation cannot ground — dismissed as
noise, or rejected at ratification — reported as a rate over all
critiques (07): a rising residual means the reviewer drifts off-spec or
the specs are vaguer than believed. *Pending* is different: an unlabeled
critique no record covers yet — a queue, not a judgment.

## Open questions

1. Re-labeling after taxonomy changes: resolved by construction
   (2026-09-07) — an unmatched record pins the axiom set it was judged
   against, so ratifying or versioning any axiom automatically
   re-queues every unidentified critique for triage; the next
   `axioms triage` reconsiders them against the new set without
   touching a single review. Already-assigned critiques keep their
   labels unless a human re-decides them at curate.
2. Cross-spec axioms: resolved (owner, 2026-09-07) — there is no
   cross-spec question, because axioms were never per-spec. An axiom
   abstracts a principle; any spec's critiques label into it. The rate
   question this raises (which opportunities form a cross-spec axiom's
   denominator) is 07's to answer honestly — until then the small-n
   floor and the uncalibrated banner carry the uncertainty.
