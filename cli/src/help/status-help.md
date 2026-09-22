When to use: a health check — document counts, per-reviewer review
state, eval coverage, structural issues, and the pending-work queues,
in one call.

Behavior:
  Pure read; never calls a reviewer. Exits 1 when any structural issue
  is found (invalid experts, orphaned practices, dangling refs,
  zero-match globs), so it doubles as a cheap CI step. Framework
  health only surfaces when the spec-layer compiler is in use.
  Eval coverage is the share of source files at least one spec governs
  — governed files over every file under `sources` minus `ignore`
  (spec files, templates, and the authored taxonomy count on neither
  side). It is the number a team maintains the way it maintains test
  coverage.

JSON (--json):
  { compilerInUse, counts { experts, practices, references, context },
    validation [ { reviewer, pass, warn, fail, notValidated } ],
    coverage { governed, sourceFiles, rate, display },
    issueCount,
    evalState { pending_triage, awaiting_curation, calibration_stale,
                epoch_boundary_detected, last_run_at },
    invalidExperts, orphanedPractices, danglingRefs,
    expertsMissingDescription, zeroMatchGlobs }
  Stable contract. evalState is the situational poll: what needs doing,
  from one call, before any discovery crawl. coverage.rate is 0-1 or
  null when sources hold no files; display is the render-ready form.

Examples:
  $ praxis status
  $ praxis status --json | jq .evalState.pending_triage

Next:
  praxis eval run       when verdicts are missing or stale
  praxis axioms triage  when pending_triage > 0
  praxis axioms curate  when awaiting_curation > 0

Docs: https://zarpay.github.io/praxis-cli/commands/status
