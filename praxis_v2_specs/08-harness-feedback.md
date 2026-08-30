# 08 — Harness Feedback

**Status:** Early draft — capturing conversation output
**Depends on:** [02](./02-baselines-and-debt-paydown.md), [04](./04-axioms.md), [07](./07-metrics.md)

## The loop, and where Praxis stops

The point of the whole system: evidence about *which harness elements to change* — skills, rules, CLAUDE.md content, tool docs — so future generations improve. Decision taken during planning:

**Praxis emits a brief. A coding agent drafts the change. A human ratifies the PR.**

Praxis does not edit the harness, and does not embed a second LLM loop of its own (a loop that would itself need evaluating — the recursion has to stop somewhere, and it stops here). The drafting happens via a generated slash command, following the exact mechanism the Claude Code plugin already uses for `/praxis-resolve`: `praxis harness suggest` produces the brief; `/praxis-harness` (generated into the plugin's commands, alongside the existing ones in `ensureCommands()`) instructs the coding agent to read it, propose harness edits, and open a reviewable PR.

## The fast loop: live feedback to the agent

Distinct from the brief (the slow loop, below): when validation runs during live coding — the agent just produced a diff, the judge critiques it — the violations feed straight back to the agent for correction. What does the agent see?

**Both forms, chosen by match state — which the two-channel judge (04) already decides:**

- **Matched (checklist channel):** the critique was born attached to an established axiom → return **the axiom** — stable ID, ratified statement, violating and compliant examples, spec grounding. The agent gets the same phrasing for the same violation every time, with teaching material attached, instead of judge prose that varies run to run.
- **Unmatched (open channel):** no established axiom covers it → return **the raw critique**. It is still actionable prose, and it flows onward to triage (04) like any open code — today's raw critique is tomorrow's axiom.

No new matching machinery is required: the channel a critique arrived through *is* the match decision. The fast loop also writes to the ledger like any run — live corrections are still evidence.

**Multiple judges (06) do not multiply the feedback list.** Matched critiques collapse to their axiom regardless of how many judges flagged it — one finding, corroboration noted — because the axiom ID is the dedup key and it already exists. Unmatched raw critiques have no shared identity to dedupe on yet, so each judge's flows through the open channel as-is; overlap among them is discovered at triage, where they land under one proposed axiom. The coding agent works a finding list, not a judge-by-judge transcript.

Delivery is the CLI (09): the coding agent or a harness hook runs `praxis eval run <target> --json` and the output is the feedback. No tool wrapper, no skill packaging — which is what keeps the fast loop harness-agnostic.

## The brief

Structured output (JSON + rendered markdown) built from ledger + metrics:

```
period, populations covered, calibration status (uninterpretable briefs say so)
top_axioms: [
  axiom_id, epoch,
  introduction_rate, paydown_rate, debt_stock,      # 02 — the evidence
  contrast?,                                        # optional: only under attribution conventions
  trend, representative_critiques (3-5, linked to ledger ids),
  suggested_diagnosis: harness_gap | spec_problem | judge_noise | insufficient_data
  implicated_harness_elements?                      # best-effort mapping, see below
]
residual_summary                                    # judge drifting off-spec? (04)
removal_candidates                                  # axioms that may no longer need Praxis (03): pattern-shaped critiques
```

The diagnosis is *suggested*, not verdicted — without a reliable control arm (02), spec-vs-harness discrimination is triangulated and the final call is human:
- Introduction rate high and flat across many diffs within the epoch, while other axioms decline, and resolution flow exists (violations get fixed when pointed out) → `harness_gap` — the standard is followable but the harness doesn't carry it into generation. The brief's main product.
- High debt density + high introduction rate + paydown attempts failing re-validation, or high judge variance on the axiom (06 — an unanswerable question is a spec defect) → `spec_problem` — route to spec owner, not harness.
- Critiques unassignable / self-refuting → `judge_noise` — route to calibration (06).
- Below small-n floor → `insufficient_data` — say so, recommend nothing.
- Where attribution conventions exist, the human/agent contrast enters as *additional evidence* for the first two — never as the mechanism.

**Expectation to state plainly: the loop will point at the spec and the judge as often as at the agent** — in the observed zarpay data, the correct first brief would be mostly `spec_problem`/`judge_noise`. That is the system working, not failing: a feedback loop that can only ever conclude "tune the agent" is the vibes-based reviewer this design exists to replace.

## Closing the loop: did the change work?

A ratified harness PR is an *intervention*, and interventions are what the drift machinery already measures:

- The brief-driven PR records which axioms it targets (trailer or PR metadata).
- Subsequent eval reports annotate those axioms' trend lines at the intervention boundary (07, rule 6 — same mechanism as judge changes).
- "Axiom AX-0011 agent rate before/after the skill change" is the honest claim this system can make: drift detection around a known intervention — not global attribution.

## Guardrails

- Briefs never auto-apply; recommendations for `spec_problem` go to spec owners as spec-change suggestions, subject to the same human ratification.
- A brief that recommends softening a spec must carry the coverage/conformance pairing (07, rule 1) — softening to improve a number is the Goodhart move the pairing exists to expose.
- Frequency: on demand and per-period, not per-run. Reacting to single-run noise is how thrash starts; the small-n floors (02) apply to briefs doubly.

## Open questions

1. Mapping axioms → harness elements: manual registry (`this skill owns events conventions`), or inferred from harness file content? Manual first; inference is a nice-to-have.
2. Should interventions be formally A/B-able (harness variant per branch/worktree, 02 open question 3)? Powerful, heavy; defer until single-arm before/after proves insufficient.
3. Does the brief include human-population findings for human consumption (the symmetric loop from 02)? The data supports it; the product question is whether anyone wants a linter for their colleagues.
