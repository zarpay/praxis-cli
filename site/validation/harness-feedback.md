# Harness Feedback

The point of the whole system: evidence about **which harness elements to change** — skills, rules, CLAUDE.md content, tool docs — so future generations improve. The loop has three roles, deliberately separated:

**Praxis emits a brief. A coding agent drafts the change. A human ratifies the PR.**

Praxis never edits the harness, and never runs a second LLM loop of its own — a loop that would itself need evaluating. The recursion stops here.

## The fast loop

When an agent (or a hook) wants live feedback on work it just produced, the delivery is the CLI itself:

```bash
praxis eval run src/services/checkout.ts --json
```

The output is the feedback, chosen by match state:

- **Matched** (the critique was born under an established axiom): the finding carries the axiom's stable ID and ratified statement — the same phrasing for the same violation every run. Depth stays behind `praxis axioms show <id>`, so the feedback is compact by reference.
- **Open channel** (no axiom covers it yet): the raw critique text, which also flows to triage — today's raw critique is tomorrow's axiom.

Multiple reviewers never multiply the list: matched critiques collapse to their axiom with corroboration counted in `witnesses`.

**The boundary:** axioms label and phrase feedback on *finished work*; they are never injected into generation. If the axiom set were fed to the agent directly, introduction rates would measure "did the agent read the checklist" instead of "does the harness carry the standard."

## The brief: `praxis harness suggest`

On demand or per period — never per run — the brief assembles the slow loop's evidence from the ledger. Pure read, no model call:

```
$ praxis harness suggest
[INFO] Harness brief — evidence, suggested diagnoses, human call
[WARN] Calibration: v32: calibrated 2026-09-05 · flash: uninterpretable — recalibrate

AX-b951db [v32] — Error messages must be specific and actionable…
  introduction rate 1/9 (11.1%) · debt stock 1 · paid down 2
  introduced 1 · resolved 1 · inherited 1 over the selected diffs
  [HARNESS_GAP] violations get fixed when pointed at (resolution flow
  exists) yet keep being introduced — the standard is followable but the
  harness does not carry it into generation
    · 20260904T…:1: "error" names neither what was wrong nor what would be accepted
```

Each top axiom carries the evidence — introduction rate, debt stock, trend, representative critiques by ledger id — and a **suggested diagnosis with its reasoning**:

| Diagnosis | Meaning | Routed to |
| --- | --- | --- |
| `harness_gap` | Followable standard the harness doesn't carry into generation | The harness — the brief's main product |
| `spec_problem` | Both eras violate it; the standard may be unanswerable | The spec owner, never the harness |
| `reviewer_noise` | Calibration measured false positives or variance on the axiom | Calibration work |
| `insufficient_data` | Below the floors | Nothing — the brief recommends nothing |

Diagnoses are *suggested, never verdicted*: there is no control arm, so the triangulation shows its work and the human makes the call. Expect the loop to point at the spec and the reviewer as often as at the agent — that is the system working, not failing.

## `/praxis-harness`: the drafting agent

`praxis compile` (with the claude-code plugin) generates `/praxis-harness` beside `/praxis-resolve`. It walks a coding agent through: read the brief (`harness suggest --json`), route each entry by its diagnosis, draft the smallest harness edit that would have prevented the representative critiques — or a spec-change suggestion, or a calibration case — and open a reviewable PR. Nothing auto-applies.

## Did the change work?

A ratified harness PR is an **intervention**. Its merge commit carries a trailer:

```
Praxis-Intervention: AX-b951db, AX-a108ea
```

Reports scan these trailers (read-only) and the axiom drill-down (`eval report --axiom <id>`) annotates each intervention boundary — rates compare before/after around a known change, never across it. "AX-b951db's agent rate before and after the skill change" is the honest claim this loop can make: drift detection around a known intervention, not global attribution.

## Guardrails

- Briefs never auto-apply; `spec_problem` recommendations go to spec owners under the same human ratification.
- A brief recommending a softer spec must carry the coverage/conformance pairing — softening to improve a number is the Goodhart move the pairing exposes.
- On demand and per period, never per run: the small-n floors apply to briefs doubly.
