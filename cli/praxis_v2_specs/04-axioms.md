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
   grounded in a sentence of its spec, so it carries no standard the
   spec does not already state. A reviewer that needs the axiom restated
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
grounded_in: backend/app/events/README.md#payload-schema # spec traceability, established at ratification
introduced: 2026-08-29
supersedes: AX-0003 # optional
---
Statement of what the axiom asserts.
A violating example. A compliant example.
```

The former `scope:`/`context:` keys are retired (2026-09-07): the spec
alone declares review scope and context (03) — an axiom that never
reaches the reviewer has nothing to scope. Historical files carrying the
keys parse fine; the keys are ignored.

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
`assigned_by: null`. Labels are applied afterwards, as append-only
records, by two verbs:

1. **`praxis axioms triage` — the labeling pass** (async, batch,
   non-interactive). The curator classifies each pending critique
   against the active axioms grounded in its governing spec —
   temperature 0, one call per spec batch. Squarely-an-instance matches
   append assignment records with `assigned_by: {decision: "matcher",
   suggested_by: <model>}`; everything else stays pending. The
   hallucination guard lives here: an id not among the spec's active
   axioms never becomes an assignment. `--dry-run` proposes without
   writing; no curator configured → warn and defer, never fake.
2. **`praxis axioms curate` — the human session** (the verb formerly
   named triage). Interactive work on the residue: cluster recurring
   critiques into proposed axioms, dismiss noise with reasons, assign
   stragglers by hand. Every decision is a ledger record.

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
- **Deprecation keeps history**: the id and its records stay readable
  forever; `supersedes` chains identity across replacements.
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
   (2026-09-07) — labels are cheap append-only records, so re-running
   triage after ratifying or versioning axioms re-labels the pending
   backlog without touching a single review. Already-assigned critiques
   keep their labels unless a human re-decides them at curate.
