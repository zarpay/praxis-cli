# Roadmap — withdrawn and deferred capabilities

Preserved designs for capabilities that are **not part of the core**
(specs, evals, axioms, reporting). Each shipped during v2 development
and was withdrawn on 2026-09-07 (owner): a rock-solid core comes first,
and advanced capabilities get rebuilt on top of it when a real need
returns.

- **06 — Calibration**: answer-key quizzes for reviewers, per-axiom
  precision/recall, variance as a noise floor, drift protocol,
  interpretability gating. (Also: a `praxis calibrate add` scaffold was
  requested during the servus adoption.)
- **08 — Harness feedback**: the brief, suggested diagnoses,
  /praxis-harness, intervention tracking.
- **12 — Git integration / diff units**: the branch as the eval unit,
  introduced/resolved/inherited flow, the PR-diff gate, introduction
  rate.
- Previously removed extras (2026-09-05): agentic mode, hunk/changeset
  scopes, the watch trigger, attribution conventions, A/B interventions,
  multi-repo, ledger partitioning/retention, PII redaction, CSV export,
  linter-annex ingestion, sampled re-baselines.

Historical ledger fields these features wrote (`flow`, `before_run_id`,
`resolved_by`, scope `"diff"`, the run `diff` block,
`calibration_status_at_run` beyond "uncalibrated") remain readable
forever — the ledger is append-only and committed evidence keeps its
shape.
