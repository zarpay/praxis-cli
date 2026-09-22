When to use: you are writing a file and want the reviewers' opinion
now — advice while the code is in flight, not evidence for the record.

Behavior:
  Same reviewers, same specs, same prose as `praxis eval run`. The run
  is recorded in the ledger with its cost like any other, but its
  critiques are recorded as advisory: they never enter triage or
  curate and never reach a report — they describe code in flight, not
  code that landed. It never writes the verdict cache, so a later
  `eval run` on the same content still calls the reviewer and records
  what it finds. The target resolves to whatever the specs govern: a
  file, a directory, or — when a spec uses `cohort: by_directory` —
  the whole cohort a named file belongs to. Always exits 0: this is
  advice, never a gate. Use `praxis eval run` when you mean the
  critiques as evidence.

JSON (--json), stable contract — the same targets shape as eval run:
  { mode: "targets", targets: [ { path,
      status: "pass" | "warn" | "fail" | "unverified",
      reason, findings: [ { text, severity, witnesses } ] } ] }

Examples:
  $ praxis feedback src/services/checkout.ts
  $ praxis feedback src/services --reviewer flash

Next:
  praxis eval run <target>   the run that counts, once the change lands
  praxis eval critiques --state advisory   re-read feedback critiques

Docs: https://zarpay.github.io/praxis-cli/commands/feedback
