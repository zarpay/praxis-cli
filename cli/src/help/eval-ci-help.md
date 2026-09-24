When to use: in a pipeline.

Behavior:
  Verifies the corpus against committed verdicts and writes nothing:
  no reviewer call, no ledger run, no cache mutation. A unit that
  cannot be evaluated is reported unverified — never a violation, but
  it still fails the gate, because unverified means the committed
  evidence does not cover the tree as it stands. --strict also fails
  on warnings. The report prints eval coverage beside the conformance
  tally — observed (the share of source files any spec governs) and
  passing (files every reviewer's verdict passes, the score to hold a
  bar against) — so the gate states how much of the corpus it actually
  gates, and how much of it currently clears.

Exit codes: 0 clean · 1 errors or unverified units · 2 usage.

Example:
  $ praxis eval ci

Next:
  praxis eval run   locally, to produce the verdicts CI verifies

Docs: https://zarpay.github.io/praxis-cli/validation/ci
