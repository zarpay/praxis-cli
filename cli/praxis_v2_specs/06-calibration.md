# 06 — Calibration

**Status:** Implemented (M6, 2026-09-05) — decisions dated inline
**Depends on:** [vocabulary.md](./vocabulary.md), [03-judgment-boundary.md](./03-judgment-boundary.md), [04-axioms.md](./04-axioms.md)

## What calibration is for

The reviewer is a measuring instrument, and instruments have error. Without a measured error rate, no conformance number is interpretable: a drop in violations cannot be distinguished from a reviewer that got lenient (model swap, provider-side update, spec edit, sampling variance). Calibration is how the system knows — and _shows_ — that its instrument still reads true.

Scope note: calibration covers judgment axioms — which, under the judgment boundary (03), is all of them. The boundary is what keeps calibration's surface small: mechanical criteria never enter Praxis, so there is no reviewer error about them to measure.

## Calibration cases

Frozen at `.praxis/calibration/cases/<id>/`:

```
input file (or diff), spec reference (by content hash — the frozen version)
expected.json:
  verdict: pass | warn | fail
  expected_violations: [ { axiom_id, must_flag: true } ]
  forbidden_violations: [ { axiom_id, must_not_flag: true } ]
  spec_path            # flagged addition (2026-09-05): staleness compares the live counterpart
  adjudicated_by, adjudicated_on, rationale
```

> **Layout as implemented (2026-09-05):** a case directory holds exactly
> one input file, the frozen spec as `spec.md` (the spec reference *is*
> its content hash, and running the case needs the text anyway), and
> `expected.json`. The reviewer's checklist for a case comes from the
> axioms grounded in the case's `spec_path` — the live grounding, so a
> ratified axiom is exactly what the case adjudicates.

**Composition rule: cases must include true positives and true negatives.** A set built only from observed reviewer false positives trains the loop toward a reviewer that passes everything; leniency must cost agreement score exactly as over-triggering does. Sources for cases:

- Spec `exemplars` (03, scoping) — spec-blessed positives, free seed cases.
- Disputed verdicts from real runs, once a human adjudicates ("confirmed false positive" outcomes from resolution workflows like `/praxis-resolve` are exactly this).
- Deliberately constructed minimal violations per axiom — the unit tests of the spec.

Cases are frozen against a spec _content hash_. When the spec changes materially, affected cases are re-adjudicated or retired — a spec edit invalidating half the calibration set is correct behavior, and visible.

## Commands and outputs

- `praxis calibrate run` — evaluates every case with the current reviewer config; reports **agreement** (verdict level), **per-axiom precision/recall**, and **false-positive rate**; writes a calibration record (with full provenance) to the ledger.
- `praxis calibrate status` — last run, scores, and whether the reviewer model or any covered spec content hash has changed since. Stale = the reviewer changed under you.

Decisions (2026-09-04/05):

- **Records live in a new ledger partition** `.praxis/ledger/calibration/<id>.json`
  (owner, 2026-09-04) — one write-once file per run × reviewer,
  `CalibrationStore`; a 10-d design event, recorded there.
- **Calibration never touches the verdict cache** (2026-09-05): a cached
  verdict would measure the cache, and `--repeat` exists to measure the
  instrument's variance, which a hit hides by construction. Every case
  is a fresh, full-price call — that is the cost answer to open question 3:
  full set on demand, sampling unneeded at current set sizes.
- **Scores are stored as counts** (TP/FP/FN, verdict matches, per-axiom
  opportunities); precision/recall derive read-side through the metrics
  rules (07), so floors and denominators apply at render.
- **A failed review is an unverified outcome** — counted as
  disagreement, recorded on the record, never dropped.
- **Drift baseline is the previous record for the same reviewer *name***,
  across identity hashes — drift is exactly what a behavioral change is
  measured for. Default threshold: 0.1 absolute per-axiom accuracy delta
  (2026-09-05, documented default).
- **Variance** comes from `calibrate run --repeat <n>`: per-axiom
  flag-count variance across repeats, stored on the record. Flow metrics
  suppress an introduction at or below the reviewer's measured variance
  for the axiom as "below reviewer noise floor" (01's consumer).

**Interpretability gating:** every eval report (07) displays calibration status. Conformance computed under a reviewer whose calibration is stale or absent is rendered with an explicit "uninterpretable — recalibrate" marker, not quietly printed. This is the enforcement point for the provenance principle.

## Multiple reviewers

Reviewers are **named and plural in config**. v1's singular `validation: { model, apiKeyEnvVar }` becomes the one-reviewer case of:

```json
"reviewers": [
  { "name": "grok",  "model": "x-ai/grok-4.1-fast",    "apiKeyEnvVar": "OPENROUTER_API_KEY" },
  { "name": "codex", "model": "openai/gpt-5.2-codex",  "apiKeyEnvVar": "OPENROUTER_API_KEY" },
  { "name": "local", "model": "org-private-model",     "baseUrl": "https://inference.internal/v1", "apiKeyEnvVar": "INTERNAL_KEY" }
]
```

A team that wants two models evaluating the same work configures both; every configured reviewer evaluates every target, contributing critiques side by side.

Where code may be sent is the org's decision, made here: a reviewer is an endpoint plus a model, so an org with private inference points its reviewers at it (per-reviewer `baseUrl` for OpenAI-compatible endpoints; per-reviewer `provider` for anything else — a custom provider module implements the normalized verdict+usage contract). Praxis does not redact — a reviewer sees exactly what the axiom's scope declares, nothing else.

**Nothing about the single-reviewer design changes — n reviewers are n instruments running the same protocol.** Each reviewer has its own reviewer hash, and therefore its own cache namespace (05), its own epochs (02), and its own calibration records. This is why the earlier decisions were shaped the way they were: provenance-mandatory verdicts and hash-namespaced caches were designed for reviewers changing _over time_; simultaneous reviewers are the same machinery with several namespaces live at once. Adding or removing a reviewer opens or ends that reviewer's series and touches nobody else's.

Critiques from all reviewers triage into the **same axiom set** — axioms are reviewer-independent (04), and a shared taxonomy is what makes reviewers comparable at all. The reduction is the point: **adding reviewers multiplies evidence, never feedback.** A violation is an axiom-anchored finding on a file. When two reviewers flag the same axiom on the same file, that is one finding with two witnesses — corroboration recorded — not two findings. Every surface a developer or agent consumes (reports, briefs, the fast loop) shows the deduplicated finding set; the per-reviewer critique records live on in the ledger, where agreement is measured. What scales with the reviewer count is the number of independent witnesses standing behind each finding, and the cost — not the length of the list anyone has to work through.

Two reviewers on the same work buy a signal frozen cases cannot provide: **inter-reviewer agreement, measured continuously on live data at no extra cost** (both verdicts are already paid for). Its two faces:

- **Corroboration** — both reviewers flag the same axiom on the same file. Evidence weight in triage (04): a corroborated critique is likelier traceable at ratification.
- **Disagreement** — one flags, the other passes. A reviewer-error signal, not a code signal, and it _locates_: axioms with persistently high disagreement rates are vaguely written or genuinely hard — the same axioms the drift protocol's variance measurement would flag, found faster.

The limit is stated plainly: **agreement is a tripwire, not ground truth.** Two reviewers sharing a blind spot agree wrongly; per-reviewer calibration against frozen, human-adjudicated cases remains the only ground truth, and interpretability gating applies per reviewer — one reviewer's stale calibration marks _its_ numbers uninterpretable, not its neighbor's.

## Drift protocol

On any reviewer-affecting change — model swap, spec edit, prompt/tooling change:

1. `calibrate run` before trusting new numbers.
2. Compare per-axiom scores to the previous record (both are in the ledger).
3. Deltas above a threshold flag the axioms whose historical rates are no longer comparable across the change; reports annotate trend lines at that boundary rather than drawing a continuous line through a discontinuity.

Reviewer nondeterminism itself is measurable here: run the same calibration N times, report per-axiom variance. High-variance axioms are candidates for spec clarification or removal (03) — variance is a property of the _question_, not just the model.

## Open questions

1. ~~Minimum viable case count before gating turns on?~~ Resolved
   (2026-09-05): the tentative answer adopted — per-axiom scores render
   through the small-n floor (n<5 suppresses as insufficient data);
   verdict-level agreement renders for any set size with its
   denominator. Interpretability gating (calibrated/stale/absent) is
   independent of set size: a thin set gives thin scores, visibly.
2. ~~Who adjudicates in practice?~~ Resolved (2026-09-05): the pragmatic
   answer — one owner per spec (`adjudicated_by` records who); revisit
   with inter-rater machinery only if it bites.
3. ~~Cost: sampling vs full-set runs.~~ Resolved (2026-09-05): full set
   every run, `--repeat` optional — at judgment-model prices a full
   pass costs cents; sampling machinery is not earned yet.
