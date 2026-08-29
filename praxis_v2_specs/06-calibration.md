# 06 — Calibration

**Status:** Early draft — capturing conversation output
**Depends on:** [vocabulary.md](./vocabulary.md), [03-judgment-boundary.md](./03-judgment-boundary.md), [04-axioms.md](./04-axioms.md)

## What calibration is for

The judge is a measuring instrument, and instruments have error. Without a measured error rate, no conformance number is interpretable: a drop in violations cannot be distinguished from a judge that got lenient (model swap, provider-side update, spec edit, sampling variance). Calibration is how the system knows — and *shows* — that its instrument still reads true.

Scope note: calibration covers judgment axioms — which, under the judgment boundary (03), is all of them. The boundary is what keeps calibration's surface small: mechanical criteria never enter Praxis, so there is no judge error about them to measure.

## Calibration cases

Frozen at `.praxis/calibration/cases/<id>/`:

```
input file (or diff), spec reference (by content hash — the frozen version)
expected.json:
  verdict: pass | warn | fail
  expected_violations: [ { axiom_id, must_flag: true } ]
  forbidden_violations: [ { axiom_id, must_not_flag: true } ]
  adjudicated_by, adjudicated_on, rationale
```

**Composition rule: cases must include true positives and true negatives.** A set built only from observed judge false positives trains the loop toward a judge that passes everything; leniency must cost agreement score exactly as over-triggering does. Sources for cases:

- Spec `exemplars` (03, scoping) — spec-blessed positives, free seed cases.
- Disputed verdicts from real runs, once a human adjudicates ("confirmed false positive" outcomes from resolution workflows like `/praxis-resolve` are exactly this).
- Deliberately constructed minimal violations per axiom — the unit tests of the spec.

Cases are frozen against a spec *content hash*. When the spec changes materially, affected cases are re-adjudicated or retired — a spec edit invalidating half the calibration set is correct behavior, and visible.

## Commands and outputs

- `praxis calibrate run` — evaluates every case with the current judge config; reports **agreement** (verdict level), **per-axiom precision/recall**, and **false-positive rate**; writes a calibration record (with full provenance) to the ledger.
- `praxis calibrate status` — last run, scores, and whether the validator model or any covered spec content hash has changed since. Stale = the judge changed under you.

**Interpretability gating:** every eval report (07) displays calibration status. Conformance computed under a judge whose calibration is stale or absent is rendered with an explicit "uninterpretable — recalibrate" marker, not quietly printed. This is the enforcement point for the provenance principle.

## Drift protocol

On any judge-affecting change — model swap, spec edit, prompt/tooling change:

1. `calibrate run` before trusting new numbers.
2. Compare per-axiom scores to the previous record (both are in the ledger).
3. Deltas above a threshold flag the axioms whose historical rates are no longer comparable across the change; reports annotate trend lines at that boundary rather than drawing a continuous line through a discontinuity.

Judge nondeterminism itself is measurable here: run the same calibration N times, report per-axiom variance. High-variance axioms are candidates for spec clarification or removal (03) — variance is a property of the *question*, not just the model.

## Open questions

1. Minimum viable case count before gating turns on? Too-small sets give noisy scores that gate on nothing. Tentative: gate per-axiom only where an axiom has ≥N adjudicated cases; verdict-level agreement gates globally.
2. Who adjudicates in practice, and how is disagreement between human adjudicators handled? (Grounded-theory answer: inter-rater reliability. Pragmatic answer: one owner per spec, revisit if it bites.)
3. Cost: calibration runs are full-price judge calls. Sampling strategies vs full-set runs on every model change.
