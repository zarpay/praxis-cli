# Roadmap

Praxis's core is **specs, evals, axioms, and reporting** — deliberately
small. The capabilities below were designed, and in some cases built and
withdrawn, and return only once that core is rock-solid.

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
