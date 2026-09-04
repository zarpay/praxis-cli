# Calibration

The reviewer is a measuring instrument, and instruments have error. Without a measured error rate, no conformance number is interpretable: a drop in violations could be code improving — or a model swap that made the reviewer lenient. Calibration is how Praxis knows, and shows, that its instrument still reads true.

Until a reviewer is calibrated, every report marks its numbers `uninterpretable — recalibrate`. That banner coming down is earned, never assumed.

## Cases: frozen, human-adjudicated ground truth

A calibration case is a directory under `.praxis/calibration/cases/<id>/` holding exactly three things:

```
.praxis/calibration/cases/vague-error-message/
├── input.ts          # the frozen code being judged
├── spec.md           # the frozen spec it was adjudicated against
└── expected.json     # the human adjudication
```

`expected.json` records what a correct reviewer must say about this input:

```json
{
  "verdict": "fail",
  "expected_violations": [{ "axiom_id": "AX-b951db", "must_flag": true }],
  "forbidden_violations": [],
  "spec_path": "src/services/README.md",
  "adjudicated_by": "sebastian",
  "adjudicated_on": "2026-09-05",
  "rationale": "\"invalid\" names neither the problem nor what would be accepted"
}
```

**Cases must include true positives and true negatives.** A set built only from things reviewers should flag trains toward an instrument that flags everything — a `pass` case with `forbidden_violations` makes leniency and over-triggering cost agreement equally. Good seed sources:

- Spec `exemplars:` — spec-blessed positives, free true-negative cases.
- Disputed verdicts from real runs, once a human adjudicates them.
- Deliberately constructed minimal violations per axiom — the unit tests of the spec.

Cases are human-owned: hand-written, reviewed in PRs, never touched by Praxis. The `spec.md` copy freezes what the adjudication meant; if the live spec changes materially, affected cases go stale visibly and are re-adjudicated or retired.

## `praxis calibrate run`

Reviews every case with the current reviewer configuration and scores the answers against the adjudications:

```
$ praxis calibrate run --reviewer v32
[INFO] Calibrating 1 reviewer(s) against 6 case(s)
	✓ vague-error-message — fail
	✓ specific-error-message — pass
	...
[INFO] Calibration — v32 · 6 case(s) × 1
verdict agreement: 6/6 (100.0%)
AX-b951db: precision 2/2 · recall 2/2 · FP 0
cost: $0.0021
```

Every case is a fresh, full-price reviewer call — the verdict cache is deliberately bypassed, because a cached verdict would measure the cache, not the instrument. The result is a **calibration record** in the ledger (`.praxis/ledger/calibration/`): reviewer identity hash, case-set hash, agreement, per-axiom precision/recall and false positives, cost — committed evidence like everything else.

`--repeat <n>` runs the full set n times and records per-axiom **variance** — the reviewer's own nondeterminism, measured. A high-variance axiom is usually a vaguely written standard, not a bad model: variance is a property of the question. Flow reports use this as a noise floor — an introduction count at or below the reviewer's measured variance renders as `below reviewer noise floor`, never as a finding.

## `praxis calibrate status`

```
$ praxis calibrate status
[INFO] Calibration status
[CALIBRATED] v32 — calibrated 2026-09-05
[STALE]      flash — reviewer identity changed since 2026-09-01 — recalibrate
```

**Stale = the reviewer changed under you.** Three things make a reviewer stale, each named in the output: its behavioral hash changed (model, prompt, options), the case set changed (a case added, removed, or edited), or a governed spec changed since its cases froze it. Absent means never calibrated at all.

## Interpretability gating

Every report — `eval report`, `debt report`, the axiom drill-down, the orientation screen — carries a per-reviewer calibration banner. A stale or absent reviewer's numbers are marked `uninterpretable — recalibrate`; a calibrated reviewer's carry its calibration date. Gating is per reviewer: one reviewer going stale never marks its neighbor's series (reviewers are never pooled).

Run records also stamp `calibration_status_at_run`, so the ledger remembers what the instrument's state was when each number was produced.

## Drift

After any reviewer-affecting change — model swap, prompt edit, spec rewrite — run `calibrate run` before trusting new numbers. The new record is compared per-axiom against the previous one for the same reviewer name; axioms whose accuracy moved beyond the threshold are flagged on the record, and the axiom drill-down annotates that boundary: rates across it are not comparable.

## Inter-reviewer agreement

With two or more reviewers, live data buys a signal frozen cases cannot: continuous agreement, at no extra cost. The axiom drill-down (`eval report --axiom <id>`) counts **corroborated** files (two or more reviewers flagged the same axiom on the same file — evidence weight) and **single-witness** files (one flagged where the others passed — a reviewer-error signal that locates vaguely written axioms). Agreement is a tripwire, not ground truth: two reviewers sharing a blind spot agree wrongly, which is why the frozen cases stay the only ground truth.
