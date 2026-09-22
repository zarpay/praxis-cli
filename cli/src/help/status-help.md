When to use: a health check in one call, as four tables — Knowledge
(documents by type, active axioms), Coverage (observed / passing / not
observed over the source corpus), Verdicts (per-reviewer review
state), and Feedback (the critique lifecycle) — plus structural
issues.

Behavior:
  Pure read; never calls a reviewer. Exits 1 when any structural issue
  is found (invalid experts, orphaned practices, dangling refs,
  zero-match globs), so it doubles as a cheap CI step. Knowledge and
  framework health only surface when the spec-layer compiler is in use.
  Coverage counts every file under `sources` minus `ignore` (spec
  files, templates, and the authored taxonomy count on neither side):
  observed — files at least one spec governs — passing, the score a CI
  can rely on (a compliant recorded verdict from every configured
  reviewer; unreviewed, warned, and failed files count against it),
  and not observed, the remainder no spec governs. These are the
  numbers a team maintains the way it maintains test coverage.

JSON (--json):
  { compilerInUse,
    counts { experts, practices, references, context, axioms },
    validation [ { reviewer, pass, warn, fail, notValidated } ],
    coverage { sourceFiles, observed { files, rate, display },
               passing { files, rate, display } },
    feedback { critiques, labeled, untriaged, awaitingCuration,
               dismissed, advisory },
    issueCount,
    evalState { pending_triage, awaiting_curation, calibration_stale,
                epoch_boundary_detected, last_run_at },
    invalidExperts, orphanedPractices, danglingRefs,
    expertsMissingDescription, zeroMatchGlobs }
  Stable contract. evalState is the situational poll: what needs doing,
  from one call, before any discovery crawl. A coverage slice's rate is
  0-1 or null when sources hold no files; display is the render-ready
  form; not observed derives as sourceFiles minus observed.files.

Examples:
  $ praxis status
  $ praxis status --json | jq .evalState.pending_triage

Next:
  praxis eval run       when verdicts are missing or stale
  praxis axioms triage  when pending_triage > 0
  praxis axioms curate  when awaiting_curation > 0

Docs: https://zarpay.github.io/praxis-cli/commands/status
