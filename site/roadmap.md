# Roadmap

Capabilities that shipped during v2 development and were deliberately
withdrawn (2026-09-07): the core of Praxis is **specs, evals, axioms,
and reporting**, and advanced capabilities return only once that core
is rock-solid. Their designs are preserved in the repo
(`cli/praxis_v2_specs/roadmap/`).

- **Diff units** — the branch as an eval unit: review both sides of a
  change, label findings introduced / resolved / inherited by
  set-difference, gate PRs on what they introduced, compute a post-spec
  introduction rate.
- **Calibration** — answer-key quizzes for reviewers: frozen
  human-adjudicated cases, per-axiom precision/recall, measured
  variance as a noise floor, drift protocol, per-reviewer
  interpretability gating.
- **Harness feedback** — the evidence-to-change loop: `harness suggest`
  briefs with suggested diagnoses, a generated `/praxis-harness`
  drafting command, and intervention tracking via commit trailers.
