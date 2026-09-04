---
description: Read the Praxis harness brief and draft harness edits (skills, rules, CLAUDE.md, tool docs) as a reviewable PR — evidence in, proposal out, human ratifies.
---

Turn Praxis's harness brief into a reviewable proposal. You draft; a human ratifies; nothing auto-applies.

## Phase 1 — Read the evidence

```bash
praxis harness suggest --json
```

Read the whole brief before proposing anything:

- **calibration** — if any reviewer reads "uninterpretable — recalibrate", say so up front: the numbers behind this brief are not interpretable for that reviewer.
- **top_axioms** — each entry carries the evidence (introduction rate, debt stock, trend, representative critiques by ledger id) and a **suggested_diagnosis with its reasoning**. The diagnosis is a suggestion, not a verdict.
- Use `praxis axioms show <id>` for any axiom's full statement and examples, and `praxis eval report --axiom <id>` for its history.

## Phase 2 — Propose, routed by diagnosis

- **harness_gap** — the standard is followable but generation doesn't carry it. Find the harness element that should own it (a skill, a rule file, CLAUDE.md, tool docs) and draft the smallest edit that would have prevented the representative critiques. Quote the axiom's statement rather than paraphrasing it.
- **spec_problem** — do NOT edit the harness. Draft a spec-change suggestion addressed to the spec owner (the axiom's `grounded_in` names the file). If the change would soften the spec, include the coverage/conformance pairing — softening to improve a number must be visible.
- **reviewer_noise** — do NOT edit anything. Recommend calibration work: `praxis calibrate run`, and a case capturing the false positive.
- **insufficient_data** — recommend nothing for this axiom. Say what evidence would change that.

## Phase 3 — The PR

Open a branch and a PR containing only the drafted edits and a summary that:

1. Names each targeted axiom and quotes the evidence line from the brief.
2. States the diagnosis you acted on and why you agreed (or overrode) the suggestion.
3. Carries the intervention trailer in the merge commit, so reports can annotate the boundary (08):

```
Praxis-Intervention: AX-xxxxxx, AX-yyyyyy
```

Do not merge it yourself. The human ratifies, and later `praxis eval report --axiom <id>` shows the before/after around the intervention boundary — that is the honest claim this loop can make.
