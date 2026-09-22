When to use: after changing a file (the fast loop), or with no targets
for the full corpus. This is the run that counts — verdict cached,
critiques queued as evidence; --json is the fast loop's feedback. For
advice on code still in flight, `praxis feedback` runs the same
reviewers without recording evidence.

Behavior:
  Reviewer calls happen only on cache misses: the cache key is a
  content hash over everything the reviewer saw (target + spec + assist
  context), so editing any of them re-reviews and unchanged content is
  free. Never delete .praxis/cache/ — it is committed, valid evidence.
  Every run appends run and critique records to .praxis/ledger/
  (append-only, committed). A reviewer whose config or prompt surface
  changed prints an epoch-boundary warning — deliberate events only.
  Findings are raw reviewer critiques; labels arrive later, at triage.
  A finding citing [AX-...] names a standing category: read it with
  `praxis axioms show <id>`.

Options in depth:
  --type      full run only: just the targets one spec type governs
  --spec      single target only: review against this spec file
  --reviewer  one configured reviewer instead of all of them
  --no-cache  force re-review (mainly to probe borderline verdicts)
  --fail-fast full run only: stop at the first error

JSON (--json), stable contract, two modes:
  targets:  { mode: "targets", targets: [ { path,
              status: "pass" | "warn" | "fail" | "unverified",
              reason, findings: [ { text, severity, witnesses } ] } ] }
  corpus:   { mode: "corpus", summary { total, compliant, warnings,
              errors, unverified, notValidated, byType, byReviewer },
              cache { hits, misses },
              coverage { sourceFiles, observed { files, rate, display },
                         passing { files, rate, display } } }
  coverage measures the source corpus: observed is the share of files
  any spec governs; passing is the CI-grade score — files every
  configured reviewer's verdict passes. The corpus report prints both
  beside the tally.

Exit codes: 0 no violations · 1 violations or run failure · 2 usage.

Targets are files or globs (quote globs so the shell passes them
through), never a bare directory: `praxis eval run "src/services/*"`.

Examples:
  $ praxis eval run src/services/checkout.ts --json
  $ praxis eval run                  # full corpus, misses only
  $ praxis eval run --type services --reviewer sonnet

Next:
  praxis feedback <target>      the same review as advice, in flight
  praxis eval verdict <target>  re-read the cached verdict, free
  praxis axioms show <id>       the standard behind a cited [AX-...]
  praxis eval critiques         browse critique ids and states

Docs: https://zarpay.github.io/praxis-cli/commands/eval
      https://zarpay.github.io/praxis-cli/validation/caching
